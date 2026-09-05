import type {
  CoverageLevel,
  DiscoveredCandidate,
  DiscoveryMeta,
  LiquorSource,
  LiquorStore,
} from '../types/store';
import { CONFIG } from './config';
import { getDistanceMeters } from './geo';
import { resolveAddress } from './osmFormat';
import { resolveStoreIdentity } from './liquorIdentity';
import { dedupeStores, rankStores } from './liquorRank';
import { findSeedCandidates } from './seedProvider';
import { findCuratedCandidates, findRename, isExcluded } from './curatedProvider';
import { findCatalogCandidates } from './poiCatalog';
import { runOverpassQuery, elementToCandidate } from './overpassProvider';
import { readNearbyTiles, writeStoresToTiles } from './storeCache';
import { lookupPaidFallback, shouldUsePaidFallback } from './fallbackProvider';

export type DiscoveryResult = {
  stores: LiquorStore[];
  rejected: DiscoveredCandidate[];
  meta: DiscoveryMeta;
};

function candidateToStore(candidate: DiscoveredCandidate): LiquorStore {
  const rename = findRename(candidate);
  const identity = resolveStoreIdentity(candidate.rawTags, {
    classifiedAsLiquor: candidate.score.accepted,
    curatedName: rename?.name ?? candidate.curatedName,
    curatedType: rename?.type ?? candidate.curatedType,
    curatedParentName: rename?.parentName ?? candidate.curatedParentName,
  });
  return {
    id: candidate.id,
    name: identity.name,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    openingHours: candidate.rawTags.opening_hours,
    address: resolveAddress(candidate.rawTags) ?? candidate.rawTags['addr:full'],
    source: candidate.source,
    locationType: identity.locationType,
    parentName: identity.parentName,
    brand: identity.brand,
    matchConfidence: candidate.score.score,
    matchReasons: candidate.score.reasons.map((r) => r.signal),
    alternativeNames: identity.alternativeNames,
    identitySource: identity.identitySource,
    osmId: candidate.osmId,
    googlePlaceId: candidate.googlePlaceId,
    phone: candidate.rawTags.phone,
    website: candidate.rawTags.website,
  };
}

function withinRadius(
  stores: LiquorStore[],
  latitude: number,
  longitude: number,
  radiusMeters: number
): LiquorStore[] {
  return stores.filter((store) => {
    const d = getDistanceMeters(latitude, longitude, store.latitude, store.longitude);
    return d <= radiusMeters;
  });
}

function coverageOf(stores: LiquorStore[], radiusMeters: number): CoverageLevel {
  if (stores.length === 0) return 'none';
  const dedicated = stores.filter(
    (s) => s.locationType === 'standalone' || (s.matchConfidence ?? 0) >= 90
  );
  if (dedicated.length >= 3 && radiusMeters <= 10000) return 'strong';
  if (stores.length >= 2) return 'ok';
  return 'thin';
}

function googleCatalog(latitude: number, longitude: number, radiusMeters: number): DiscoveredCandidate[] {
  return findCatalogCandidates(latitude, longitude, radiusMeters, ['google-places']);
}

function eclbCatalog(latitude: number, longitude: number, radiusMeters: number): DiscoveredCandidate[] {
  return findCatalogCandidates(latitude, longitude, radiusMeters, ['eclb']);
}

function assemble(
  candidates: DiscoveredCandidate[],
  latitude: number,
  longitude: number,
  radiusMeters: number,
  metaBase: Partial<DiscoveryMeta>
): DiscoveryResult {
  const rejected: DiscoveredCandidate[] = [];
  const accepted: DiscoveredCandidate[] = [];

  for (const candidate of candidates) {
    if (isExcluded(candidate)) {
      rejected.push({
        ...candidate,
        score: {
          ...candidate.score,
          accepted: false,
          reasons: [
            ...candidate.score.reasons,
            { signal: 'curated exclusion', score: 0 },
          ],
        },
      });
      continue;
    }
    if (!candidate.score.accepted) {
      rejected.push(candidate);
      continue;
    }
    accepted.push(candidate);
  }

  const stores = rankStores(
    withinRadius(
      dedupeStores(accepted.map(candidateToStore)),
      latitude,
      longitude,
      radiusMeters
    )
  );

  const sourcesUsed = [...new Set(stores.map((s) => s.source))] as LiquorSource[];

  return {
    stores,
    rejected,
    meta: {
      fromCache: false,
      cacheStale: false,
      overpassAttempted: false,
      overpassSucceeded: false,
      fallbackAttempted: false,
      coverage: coverageOf(stores, radiusMeters),
      sourcesUsed,
      rejectedCount: rejected.length,
      ...metaBase,
    },
  };
}

/**
 * Instant local discovery: curated corrections + bundled OSM snapshot +
 * additive Google Places catalog + conservative ECLB gap pins + any
 * tiled cache. No network. Safe to paint the compass with.
 */
export function discoverLocal(
  latitude: number,
  longitude: number,
  radiusMeters: number
): DiscoveryResult {
  const curated = findCuratedCandidates(latitude, longitude, radiusMeters);
  const seed = findSeedCandidates(latitude, longitude, radiusMeters);
  const google = googleCatalog(latitude, longitude, radiusMeters);
  const eclb = eclbCatalog(latitude, longitude, radiusMeters);
  const cached = readNearbyTiles(latitude, longitude);

  const cacheCandidates: DiscoveredCandidate[] = cached.stores.map((store) => ({
    id: store.id,
    latitude: store.latitude,
    longitude: store.longitude,
    rawTags: {
      name: store.name,
      brand: store.brand,
      opening_hours: store.openingHours,
      phone: store.phone,
      website: store.website,
    },
    score: {
      score: store.matchConfidence ?? 80,
      accepted: true,
      reasons: (store.matchReasons ?? []).map((signal) => ({ signal, score: store.matchConfidence ?? 80 })),
    },
    source: 'cache',
    osmId: store.osmId,
    googlePlaceId: store.googlePlaceId,
    curatedName: store.source === 'curated' ? store.name : undefined,
    curatedType: store.locationType,
    curatedParentName: store.parentName,
  }));

  const merged = [...curated, ...seed, ...google, ...eclb, ...cacheCandidates];
  return assemble(merged, latitude, longitude, radiusMeters, {
    fromCache: cached.stores.length > 0,
    cacheStale: cached.stale,
    sourcesUsed: [
      ...(curated.length ? (['curated'] as const) : []),
      ...(seed.length ? (['osm-seed'] as const) : []),
      ...(google.length ? (['google-places'] as const) : []),
      ...(eclb.length ? (['eclb'] as const) : []),
      ...(cached.stores.length ? (['cache'] as const) : []),
    ],
  });
}

/**
 * Network refresh: Overpass (raced) + merge with local sources including
 * the Google Places catalog and conservative ECLB gap pins. Provider
 * results are merged additively.
 * Paid session fallback only if every durable source came back empty.
 *
 * If Overpass returns 0 or 4 records, existing seed/curated/google/eclb
 * catalog records are still assembled — never replaced.
 */
export async function discoverRefresh(
  latitude: number,
  longitude: number,
  radiusMeters: number
): Promise<DiscoveryResult> {
  const local = discoverLocal(latitude, longitude, radiusMeters);
  let overpassCandidates: DiscoveredCandidate[] = [];
  let overpassSucceeded = false;
  let overpassAttempted = true;

  try {
    const elements = await runOverpassQuery(latitude, longitude, radiusMeters);
    overpassSucceeded = true;
    for (const element of elements) {
      const candidate = elementToCandidate(element, 'osm');
      if (candidate) overpassCandidates.push(candidate);
    }
  } catch {
    overpassSucceeded = false;
  }

  const curated = findCuratedCandidates(latitude, longitude, radiusMeters);
  const seed = findSeedCandidates(latitude, longitude, radiusMeters);
  const google = googleCatalog(latitude, longitude, radiusMeters);
  const eclb = eclbCatalog(latitude, longitude, radiusMeters);
  const merged = assemble(
    [...curated, ...seed, ...google, ...eclb, ...overpassCandidates],
    latitude,
    longitude,
    radiusMeters,
    {
      fromCache: false,
      cacheStale: false,
      overpassAttempted,
      overpassSucceeded,
    }
  );

  if (merged.stores.length > 0) {
    writeStoresToTiles(merged.stores);
  }

  if (merged.stores.length === 0) {
    const decision = shouldUsePaidFallback({
      enabled: CONFIG.paidFallbackEnabled,
      keyConfigured: false,
      acceptedCount: 0,
      overpassAttempted: true,
    });
    if (decision.ok) {
      const fallback = await lookupPaidFallback({ latitude, longitude, radiusMeters });
      merged.meta.fallbackAttempted = fallback.fired;
      if (fallback.stores.length > 0) {
        return {
          stores: fallback.stores,
          rejected: merged.rejected,
          meta: {
            ...merged.meta,
            fallbackAttempted: true,
            coverage: coverageOf(fallback.stores, radiusMeters),
            sourcesUsed: ['places-fallback'],
          },
        };
      }
    }
  }

  // If Overpass failed but local data exists, keep serving it.
  if (!overpassSucceeded && local.stores.length > 0 && merged.stores.length === 0) {
    return {
      ...local,
      meta: {
        ...local.meta,
        overpassAttempted: true,
        overpassSucceeded: false,
      },
    };
  }

  return merged;
}

export function withDistances(
  stores: LiquorStore[],
  latitude: number,
  longitude: number
): LiquorStore[] {
  return rankStores(
    stores.map((store) => ({
      ...store,
      distanceMeters: getDistanceMeters(latitude, longitude, store.latitude, store.longitude),
    }))
  );
}
