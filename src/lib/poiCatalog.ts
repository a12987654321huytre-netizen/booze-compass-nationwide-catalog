/**
 * Canonical Booze Compass POI catalog.
 *
 * Existing records come from the OSM seed + curated layer. Google Places
 * discoveries are a separate additive file. Nothing in this module
 * deletes a POI because a provider omitted it.
 */

import type { DiscoveredCandidate, LiquorLocationType, LiquorSource } from '../types/store';
import type { SAProvince } from './saGeography';
import { resolveProvince } from './saGeography';
import { getDistanceMeters } from './geo';
import { resolveAddress } from './osmFormat';
import { scoreLiquorCandidate } from './liquorScoring';
import { resolveStoreIdentity } from './liquorIdentity';
import { elementToCandidate } from './overpassProvider';
import type { OverpassElement } from './overpassProvider';
import { CURATED_ADDITIONS } from '../data/curatedPois';
import osmSeed from '../data/osm-seed.json';
import googlePlacesFile from '../data/googlePlacesPois.json';
import eclbEnrichmentFile from '../data/eclbEnrichment.json';
import eclbNewPoiFile from '../data/eclbNewPois.json';
import { fillEmptyFields } from './poiIntegrity';
import { matchObservation, shouldAddAsNewPoi, shouldEnrichExisting } from './poiMatch';
import type { GooglePlaceObservation } from './googlePlacesProvider';
import { applyAdditiveInserts, assertAdditive } from './poiIntegrity';
import type { EclbEnrichmentFile, EclbNewPoiFile } from './eclb';

export type CatalogPoi = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  phone?: string;
  website?: string;
  openingHours?: string;
  brand?: string;
  locationType: LiquorLocationType;
  parentName?: string;
  source: LiquorSource;
  osmId?: string;
  googlePlaceId?: string;
  province?: SAProvince;
  city?: string;
  matchConfidence?: number;
  /** Backend-only ECLB licence fields. Never copied onto LiquorStore.name. */
  eclbRegNo?: string;
  eclbLicenceHolder?: string;
  eclbHolderType?: string;
  eclbId?: number;
};

export type PoiEnrichment = {
  existingId: string;
  googlePlaceId?: string;
  phone?: string;
  website?: string;
  openingHours?: string;
  address?: string;
};

export type ReviewCandidate = {
  googlePlaceId: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  matchClass: 'MATCH_LIKELY' | 'POSSIBLE_MATCH';
  existingId?: string;
  existingName?: string;
  distanceMeters?: number;
  reasons: string[];
  province?: SAProvince;
};

export type GooglePlacesFile = {
  version: number;
  generatedAt: string | null;
  pois: CatalogPoi[];
  enrichment: PoiEnrichment[];
  reviewCandidates: ReviewCandidate[];
  audit?: unknown;
};

type SeedRecord = {
  type: OverpassElement['type'] | string;
  id: number;
  lat: number;
  lon: number;
  tags: Record<string, string | undefined>;
};

const SEED = osmSeed as SeedRecord[];
const GOOGLE_FILE = googlePlacesFile as GooglePlacesFile;
const ECLB_ENRICHMENT = eclbEnrichmentFile as EclbEnrichmentFile;
const ECLB_NEW = eclbNewPoiFile as EclbNewPoiFile;

function cityFromAddress(address?: string): string | undefined {
  if (!address) return undefined;
  const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return undefined;
  const withoutCountry = parts.filter((part) => !/^south africa$/i.test(part) && !/^\d{4}$/.test(part));
  return withoutCountry[withoutCountry.length - 1];
}

function seedToCatalog(): CatalogPoi[] {
  const out: CatalogPoi[] = [];
  for (const record of SEED) {
    const element: OverpassElement = {
      type: record.type as OverpassElement['type'],
      id: record.id,
      lat: record.lat,
      lon: record.lon,
      tags: record.tags,
    };
    const candidate = elementToCandidate(element, 'osm-seed');
    if (!candidate) continue;
    const identity = resolveStoreIdentity(candidate.rawTags, { classifiedAsLiquor: candidate.score.accepted });
    const address = resolveAddress(candidate.rawTags);
    out.push({
      id: candidate.id,
      name: identity.name,
      latitude: candidate.latitude,
      longitude: candidate.longitude,
      address,
      openingHours: candidate.rawTags.opening_hours,
      brand: identity.brand,
      locationType: identity.locationType,
      parentName: identity.parentName,
      source: 'osm-seed',
      osmId: candidate.osmId,
      province: resolveProvince(candidate.latitude, candidate.longitude, address),
      city: candidate.rawTags['addr:city'] ?? candidate.rawTags['addr:suburb'] ?? cityFromAddress(address),
      matchConfidence: candidate.score.score,
    });
  }
  return out;
}

function curatedToCatalog(): CatalogPoi[] {
  return CURATED_ADDITIONS.map((poi) => ({
    id: poi.id,
    name: poi.name,
    latitude: poi.latitude,
    longitude: poi.longitude,
    address: poi.address,
    openingHours: poi.openingHours,
    locationType: poi.type,
    parentName: poi.parentName,
    source: 'curated' as const,
    province: resolveProvince(poi.latitude, poi.longitude, poi.address),
    city: poi.address,
    matchConfidence: 100,
  }));
}

function applyEnrichment(pois: CatalogPoi[], enrichment: PoiEnrichment[]): CatalogPoi[] {
  if (!enrichment.length) return pois;
  const byId = new Map(enrichment.map((row) => [row.existingId, row]));
  return pois.map((poi) => {
    const extra = byId.get(poi.id);
    if (!extra) return poi;
    return fillEmptyFields(poi, extra, [
      'googlePlaceId',
      'phone',
      'website',
      'openingHours',
      'address',
    ]);
  });
}

function eclbNewToCatalog(): CatalogPoi[] {
  return (ECLB_NEW.pois ?? []).map((poi) => ({
    id: poi.id,
    name: poi.name,
    latitude: poi.latitude,
    longitude: poi.longitude,
    address: poi.address,
    brand: poi.brand,
    locationType: poi.locationType,
    parentName: poi.parentName,
    source: 'eclb' as const,
    province: poi.province,
    city: poi.city,
    matchConfidence: 85,
    eclbRegNo: poi.eclbRegNo,
    eclbLicenceHolder: poi.eclbLicenceHolder,
    eclbHolderType: poi.eclbHolderType,
    eclbId: poi.eclbId,
  }));
}

/**
 * Attach ECLB licence fields to existing POIs. Never renames.
 * Address is filled only when the catalog row has none.
 */
function applyEclbEnrichment(pois: CatalogPoi[]): CatalogPoi[] {
  const rows = ECLB_ENRICHMENT.enrichment ?? [];
  if (!rows.length) return pois;
  const byId = new Map(rows.map((row) => [row.existingId, row]));
  return pois.map((poi) => {
    const extra = byId.get(poi.id);
    if (!extra) return poi;
    const withAddress = extra.address
      ? fillEmptyFields(poi, { address: extra.address }, ['address'])
      : poi;
    return {
      ...withAddress,
      name: poi.name,
      eclbRegNo: extra.eclbRegNo,
      eclbLicenceHolder: extra.eclbLicenceHolder,
      eclbHolderType: extra.eclbHolderType,
      eclbId: extra.eclbId,
    };
  });
}

let cachedCatalog: CatalogPoi[] | null = null;

/** Test/script hook. Production code never needs this. */
export function resetCatalogCache(): void {
  cachedCatalog = null;
}

/** Existing seed + curated + previously added Google discoveries. IDs are stable. */
export function loadCatalog(): CatalogPoi[] {
  if (cachedCatalog) return cachedCatalog;
  const existing = [...seedToCatalog(), ...curatedToCatalog()];
  const withGoogle = applyAdditiveInserts(existing, GOOGLE_FILE.pois ?? []);
  const withEclb = applyAdditiveInserts(withGoogle.catalog, eclbNewToCatalog());
  assertAdditive(
    existing.map((poi) => poi.id),
    withEclb.catalog.map((poi) => poi.id),
    'loadCatalog'
  );
  const googleEnriched = applyEnrichment(withEclb.catalog, GOOGLE_FILE.enrichment ?? []);
  cachedCatalog = applyEclbEnrichment(googleEnriched);
  return cachedCatalog;
}

export function catalogCount(): number {
  return loadCatalog().length;
}

export function existingCatalogWithoutGoogle(): CatalogPoi[] {
  return applyEnrichment([...seedToCatalog(), ...curatedToCatalog()], GOOGLE_FILE.enrichment ?? []);
}

export function googleCatalogPois(): CatalogPoi[] {
  return GOOGLE_FILE.pois ?? [];
}

export function catalogPoiToCandidate(poi: CatalogPoi): DiscoveredCandidate {
  const tags = {
    name: poi.name,
    brand: poi.brand,
    opening_hours: poi.openingHours,
    'addr:full': poi.address,
    phone: poi.phone,
    website: poi.website,
    shop: poi.locationType === 'attached-counter' ? 'supermarket' : 'alcohol',
    alcohol: 'yes',
    ...(poi.parentName ? { operator: poi.parentName } : {}),
  };
  return {
    id: poi.id,
    latitude: poi.latitude,
    longitude: poi.longitude,
    rawTags: tags,
    score: scoreLiquorCandidate(tags, poi.name),
    source: poi.source,
    osmId: poi.osmId,
    googlePlaceId: poi.googlePlaceId,
    curatedName:
      poi.source === 'curated' || poi.source === 'google-places' || poi.source === 'eclb'
        ? poi.name
        : undefined,
    curatedType: poi.locationType,
    curatedParentName: poi.parentName,
  };
}

export function findCatalogCandidates(
  latitude: number,
  longitude: number,
  radiusMeters: number,
  sources?: LiquorSource[]
): DiscoveredCandidate[] {
  const allow = sources ? new Set(sources) : null;
  const out: DiscoveredCandidate[] = [];
  for (const poi of loadCatalog()) {
    if (allow && !allow.has(poi.source)) continue;
    if (getDistanceMeters(latitude, longitude, poi.latitude, poi.longitude) > radiusMeters) continue;
    out.push(catalogPoiToCandidate(poi));
  }
  return out;
}

export function observationToCatalogPoi(observation: GooglePlaceObservation): CatalogPoi {
  const identity = resolveStoreIdentity(
    { name: observation.name, shop: 'alcohol' },
    { classifiedAsLiquor: true }
  );
  return {
    id: `gplaces-${observation.googlePlaceId}`,
    name: identity.name,
    latitude: observation.latitude,
    longitude: observation.longitude,
    address: observation.address,
    phone: observation.phone,
    website: observation.website,
    openingHours: observation.openingHours,
    brand: identity.brand,
    locationType: identity.locationType,
    parentName: identity.parentName,
    source: 'google-places',
    googlePlaceId: observation.googlePlaceId,
    province: observation.province ?? resolveProvince(observation.latitude, observation.longitude, observation.address),
    city: cityFromAddress(observation.address),
    matchConfidence: 90,
  };
}

export type DiscoveryIngestResult = {
  catalog: CatalogPoi[];
  added: CatalogPoi[];
  confirmedMatches: number;
  likelyMatches: number;
  possibleMatches: number;
  newPoiCandidates: number;
  enrichment: PoiEnrichment[];
  reviewCandidates: ReviewCandidate[];
};

/**
 * Compare provider observations to the catalog and return an *additive*
 * next catalog. Existing records always survive. Only NEW_POI observations
 * become new rows. MATCH_CONFIRMED may fill empty fields. Uncertain
 * identities go to review, not into the catalog and not into a merge.
 */
export function ingestObservations(
  existing: readonly CatalogPoi[],
  observations: readonly GooglePlaceObservation[]
): DiscoveryIngestResult {
  const beforeIds = existing.map((poi) => poi.id);
  let catalog = [...existing];
  const added: CatalogPoi[] = [];
  const enrichment: PoiEnrichment[] = [];
  const reviewCandidates: ReviewCandidate[] = [];
  let confirmedMatches = 0;
  let likelyMatches = 0;
  let possibleMatches = 0;
  let newPoiCandidates = 0;

  const seenPlaceIds = new Set(
    catalog.map((poi) => poi.googlePlaceId).filter((id): id is string => Boolean(id))
  );

  for (const observation of observations) {
    if (seenPlaceIds.has(observation.googlePlaceId)) {
      confirmedMatches += 1;
      continue;
    }
    const matchable = observationToCatalogPoi(observation);
    const result = matchObservation(matchable, catalog);
    if (result.class === 'MATCH_CONFIRMED' && result.existing && shouldEnrichExisting(result)) {
      confirmedMatches += 1;
      seenPlaceIds.add(observation.googlePlaceId);
      catalog = catalog.map((poi) => {
        if (poi.id !== result.existing?.id) return poi;
        const next = fillEmptyFields(poi, {
          googlePlaceId: observation.googlePlaceId,
          phone: observation.phone,
          website: observation.website,
          openingHours: observation.openingHours,
          address: observation.address,
        }, ['googlePlaceId', 'phone', 'website', 'openingHours', 'address']);
        enrichment.push({
          existingId: poi.id,
          googlePlaceId: observation.googlePlaceId,
          phone: observation.phone,
          website: observation.website,
          openingHours: observation.openingHours,
          address: observation.address,
        });
        return next;
      });
      continue;
    }
    if (result.class === 'MATCH_LIKELY') {
      likelyMatches += 1;
      reviewCandidates.push({
        googlePlaceId: observation.googlePlaceId,
        name: observation.name,
        latitude: observation.latitude,
        longitude: observation.longitude,
        address: observation.address,
        matchClass: 'MATCH_LIKELY',
        existingId: result.existing?.id,
        existingName: result.existing?.name,
        distanceMeters: result.evidence?.distanceMeters,
        reasons: result.reasons,
        province: observation.province,
      });
      continue;
    }
    if (result.class === 'POSSIBLE_MATCH') {
      possibleMatches += 1;
      reviewCandidates.push({
        googlePlaceId: observation.googlePlaceId,
        name: observation.name,
        latitude: observation.latitude,
        longitude: observation.longitude,
        address: observation.address,
        matchClass: 'POSSIBLE_MATCH',
        existingId: result.existing?.id,
        existingName: result.existing?.name,
        distanceMeters: result.evidence?.distanceMeters,
        reasons: result.reasons,
        province: observation.province,
      });
      continue;
    }
    if (shouldAddAsNewPoi(result)) {
      newPoiCandidates += 1;
      if (seenPlaceIds.has(observation.googlePlaceId)) continue;
      seenPlaceIds.add(observation.googlePlaceId);
      added.push(matchable);
      catalog.push(matchable);
    }
  }

  assertAdditive(beforeIds, catalog.map((poi) => poi.id), 'ingestObservations');

  return {
    catalog,
    added,
    confirmedMatches,
    likelyMatches,
    possibleMatches,
    newPoiCandidates,
    enrichment,
    reviewCandidates,
  };
}

export type CatalogStats = {
  total: number;
  byProvince: Record<string, number>;
  byCity: Record<string, number>;
  bySource: Record<string, number>;
};

export function catalogStats(catalog: readonly CatalogPoi[] = loadCatalog()): CatalogStats {
  const byProvince: Record<string, number> = {};
  const byCity: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  for (const poi of catalog) {
    const province = poi.province ?? 'unknown';
    const city = poi.city ?? 'unknown';
    byProvince[province] = (byProvince[province] ?? 0) + 1;
    byCity[city] = (byCity[city] ?? 0) + 1;
    bySource[poi.source] = (bySource[poi.source] ?? 0) + 1;
  }
  return { total: catalog.length, byProvince, byCity, bySource };
}
