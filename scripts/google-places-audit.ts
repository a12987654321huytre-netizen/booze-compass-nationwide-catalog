/**
 * Nationwide Google Places discovery audit for Booze Compass.
 *
 * Google Places is a discovery source, not a replacement database.
 * This script:
 *   1. Reads the existing catalog (OSM seed + curated + prior Google adds)
 *   2. Queries Places across all nine South African provinces
 *   3. Matches observations against existing physical locations
 *   4. Adds only NEW_POI rows
 *   5. Fills empty fields on MATCH_CONFIRMED
 *   6. Writes MATCH_LIKELY / POSSIBLE_MATCH to review — never merges them
 *
 * Absence, timeout, zero-results, and partial pages never delete a row.
 *
 * Usage:
 *   GOOGLE_PLACES_API_KEY=... npm run audit:places
 *   GOOGLE_PLACES_API_KEY=... npm run audit:places -- --resume
 *
 * The API key must never ship to the browser. This script is Node-only.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SA_PROVINCES,
  SA_SEARCH_GRID,
  type SAProvince,
  type SearchPoint,
} from '../src/lib/saGeography';
import {
  dedupeObservations,
  nearbyLiquorSearch,
  textLiquorSearch,
  type GooglePlaceObservation,
  type GooglePlacesConfig,
  type GoogleQueryResult,
} from '../src/lib/googlePlacesProvider';
import {
  catalogStats,
  existingCatalogWithoutGoogle,
  googleCatalogPois,
  ingestObservations,
  type CatalogPoi,
  type GooglePlacesFile,
  type PoiEnrichment,
} from '../src/lib/poiCatalog';
import { applyAdditiveInserts, assertAdditive } from '../src/lib/poiIntegrity';
import type { ProviderSourceState } from '../src/lib/poiIntegrity';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_FILE = resolve(ROOT, 'src/data/googlePlacesPois.json');
const CHECKPOINT = resolve(ROOT, 'artifacts/places-audit-checkpoint.json');
const REPORT_FILE = resolve(ROOT, 'artifacts/places-audit-report.json');

const AFRIKAANS_PROVINCES = new Set<SAProvince>([
  'Western Cape',
  'Northern Cape',
  'Free State',
  'North West',
  'Eastern Cape',
]);

type Checkpoint = {
  completedQueryIds: string[];
  observations: GooglePlaceObservation[];
  queries: Array<{
    queryId: string;
    query: string;
    state: ProviderSourceState;
    count: number;
    error?: string;
    province: SAProvince;
    place: string;
  }>;
  startedAt: string;
};

function parseArgs(argv: string[]) {
  return {
    resume: argv.includes('--resume'),
    nearbyOnly: argv.includes('--nearby-only'),
    limit: (() => {
      const idx = argv.indexOf('--limit');
      return idx === -1 ? Infinity : Number(argv[idx + 1] || Infinity);
    })(),
    provinces: (() => {
      const idx = argv.indexOf('--provinces');
      if (idx === -1) return null;
      const raw = argv[idx + 1] || '';
      const wanted = raw.split(',').map((s) => s.trim()).filter(Boolean);
      return wanted.length ? wanted : null;
    })(),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function atomicWrite(filePath: string, contents: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  writeFileSync(tmp, contents);
  try {
    renameSync(tmp, filePath);
  } catch {
    writeFileSync(filePath, contents);
  }
}

function loadCheckpoint(): Checkpoint | null {
  if (!existsSync(CHECKPOINT)) return null;
  try {
    return JSON.parse(readFileSync(CHECKPOINT, 'utf8')) as Checkpoint;
  } catch {
    return null;
  }
}

function saveCheckpoint(checkpoint: Checkpoint): void {
  atomicWrite(CHECKPOINT, JSON.stringify(checkpoint));
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      out[index] = await fn(items[index], index);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return out;
}

async function withBackoff(
  label: string,
  run: () => Promise<GoogleQueryResult>
): Promise<GoogleQueryResult> {
  let attempt = 0;
  let last: GoogleQueryResult | null = null;
  while (attempt < 4) {
    last = await run();
    if (last.state !== 'SOURCE_UNAVAILABLE' && last.state !== 'SOURCE_TIMEOUT') return last;
    const wait = 1500 * 2 ** attempt;
    console.warn(`  retry ${label} in ${wait}ms (${last.state}${last.error ? `: ${last.error}` : ''})`);
    await sleep(wait);
    attempt += 1;
  }
  return last!;
}

function compactPoi(poi: CatalogPoi): CatalogPoi {
  const out: CatalogPoi = {
    id: poi.id,
    name: poi.name,
    latitude: poi.latitude,
    longitude: poi.longitude,
    locationType: poi.locationType,
    source: poi.source,
  };
  if (poi.address) out.address = poi.address;
  if (poi.phone) out.phone = poi.phone;
  if (poi.website) out.website = poi.website;
  if (poi.openingHours) out.openingHours = poi.openingHours;
  if (poi.brand) out.brand = poi.brand;
  if (poi.parentName) out.parentName = poi.parentName;
  if (poi.osmId) out.osmId = poi.osmId;
  if (poi.googlePlaceId) out.googlePlaceId = poi.googlePlaceId;
  if (poi.province) out.province = poi.province;
  if (poi.city) out.city = poi.city;
  if (poi.matchConfidence != null) out.matchConfidence = poi.matchConfidence;
  return out;
}

function buildQueryPlan(points: SearchPoint[], nearbyOnly: boolean) {
  type PlanItem =
    | { kind: 'nearby'; point: SearchPoint; queryId: string }
    | { kind: 'text'; point: SearchPoint; queryId: string; textQuery: string };

  const plan: PlanItem[] = [];
  for (const point of points) {
    plan.push({ kind: 'nearby', point, queryId: `${point.id}:nearby` });
  }
  if (nearbyOnly) return plan;

  for (const point of points) {
    if (point.textSearch) {
      plan.push({
        kind: 'text',
        point,
        queryId: `${point.id}:text-bottle`,
        textQuery: `bottle store in ${point.name}, ${point.province}, South Africa`,
      });
    }
    if (point.kind === 'town' && AFRIKAANS_PROVINCES.has(point.province) && point.textSearch) {
      plan.push({
        kind: 'text',
        point,
        queryId: `${point.id}:text-drankwinkel`,
        textQuery: `drankwinkel ${point.name}, South Africa`,
      });
    }
    if (point.kind === 'metro-core' || point.kind === 'city') {
      plan.push({
        kind: 'text',
        point,
        queryId: `${point.id}:text-cellar`,
        textQuery: `Woolworths Cellar in ${point.name}, South Africa`,
      });
    }
  }
  return plan;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) {
    console.error('GOOGLE_PLACES_API_KEY is required. This key must never be bundled into the app.');
    process.exit(1);
  }

  const config: GooglePlacesConfig = { apiKey };
  const seedAndCurated = existingCatalogWithoutGoogle();
  const previousGoogle = googleCatalogPois();
  const existing = applyAdditiveInserts(seedAndCurated, previousGoogle).catalog;
  const originalIds = existing.map((poi) => poi.id);

  console.log(`Existing catalog: ${existing.length} (seed+curated ${seedAndCurated.length}, prior Google ${previousGoogle.length})`);
  console.log(`Original IDs that must survive: ${originalIds.length}`);

  let points = [...SA_SEARCH_GRID];
  if (args.provinces) {
    const wanted = new Set(args.provinces.map((p) => p.toLowerCase()));
    points = points.filter((p) => wanted.has(p.province.toLowerCase()) || wanted.has(p.id));
  }
  points = points.slice(0, args.limit);

  const covered = new Set(points.map((p) => p.province));
  console.log(`Search points: ${points.length} across ${covered.size} provinces`);
  for (const province of SA_PROVINCES) {
    const n = points.filter((p) => p.province === province).length;
    console.log(`  ${province}: ${n} points`);
  }

  const plan = buildQueryPlan(points, args.nearbyOnly);
  const checkpoint: Checkpoint =
    args.resume && loadCheckpoint()
      ? loadCheckpoint()!
      : { completedQueryIds: [], observations: [], queries: [], startedAt: new Date().toISOString() };

  const done = new Set(checkpoint.completedQueryIds);
  const remaining = plan.filter((item) => !done.has(item.queryId));
  console.log(`Queries: ${plan.length} planned, ${done.size} already done, ${remaining.length} remaining`);

  let finished = 0;
  await mapPool(remaining, 3, async (item) => {
    const result =
      item.kind === 'nearby'
        ? await withBackoff(item.queryId, () =>
            nearbyLiquorSearch(
              {
                queryId: item.queryId,
                latitude: item.point.latitude,
                longitude: item.point.longitude,
                radiusMeters: item.point.radiusMeters,
                paginate: item.point.kind !== 'town',
              },
              config
            )
          )
        : await withBackoff(item.queryId, () =>
            textLiquorSearch(
              {
                queryId: item.queryId,
                textQuery: item.textQuery,
                latitude: item.point.latitude,
                longitude: item.point.longitude,
                radiusMeters: Math.min(item.point.radiusMeters * 2, 40000),
                paginate: false,
              },
              config
            )
          );

    checkpoint.completedQueryIds.push(item.queryId);
    checkpoint.observations.push(...result.observations);
    checkpoint.queries.push({
      queryId: item.queryId,
      query: result.query,
      state: result.state,
      count: result.observations.length,
      error: result.error,
      province: item.point.province,
      place: item.point.name,
    });
    finished += 1;
    if (finished % 5 === 0 || result.state !== 'SOURCE_SUCCESS') {
      saveCheckpoint(checkpoint);
      console.log(
        `  [${finished}/${remaining.length}] ${item.queryId} ${result.state} +${result.observations.length} (unique so far ${dedupeObservations(checkpoint.observations).length})`
      );
    } else {
      process.stdout.write(
        `  [${finished}/${remaining.length}] ${item.queryId} ${result.state} +${result.observations.length}\n`
      );
    }
    await sleep(80);
  });

  saveCheckpoint(checkpoint);

  const observations = dedupeObservations(checkpoint.observations);
  console.log(`\nUnique Google observations: ${observations.length}`);

  const ingest = ingestObservations(existing, observations);
  assertAdditive(originalIds, ingest.catalog.map((poi) => poi.id), 'google-places-audit');

  const googlePois = ingest.catalog.filter((poi) => poi.source === 'google-places').map(compactPoi);
  const previousGoogleIds = previousGoogle.map((poi) => poi.id);
  assertAdditive(previousGoogleIds, googlePois.map((poi) => poi.id), 'google-places-audit prior Google rows');

  const enrichmentById = new Map<string, PoiEnrichment>();
  for (const row of ingest.enrichment) enrichmentById.set(row.existingId, row);

  const queriesByState: Record<string, number> = {};
  for (const query of checkpoint.queries) {
    queriesByState[query.state] = (queriesByState[query.state] ?? 0) + 1;
  }

  const limitations: string[] = [];
  if ((queriesByState.SOURCE_FAILED ?? 0) > 0) limitations.push(`${queriesByState.SOURCE_FAILED} queries failed`);
  if ((queriesByState.SOURCE_TIMEOUT ?? 0) > 0) limitations.push(`${queriesByState.SOURCE_TIMEOUT} queries timed out`);
  if ((queriesByState.SOURCE_UNAVAILABLE ?? 0) > 0) {
    limitations.push(`${queriesByState.SOURCE_UNAVAILABLE} queries unavailable / quota`);
  }
  if ((queriesByState.SOURCE_ZERO_RESULTS ?? 0) > 0) {
    limitations.push(
      `${queriesByState.SOURCE_ZERO_RESULTS} zero-result queries — this is not evidence those areas have zero bottle stores`
    );
  }
  if ((queriesByState.SOURCE_PARTIAL_RESULTS ?? 0) > 0) {
    limitations.push(`${queriesByState.SOURCE_PARTIAL_RESULTS} partial pages (20-result cap or pagination cut-off)`);
  }
  limitations.push('Nearby Search returns at most 60 results per point (3 pages × 20). Dense metros are partitioned, not queried as one city.');
  limitations.push('Place Details were not requested (cost). Phone/website/hours are only present when the search response included them.');
  limitations.push('Google coverage is an observation set, not a census. Thin results in Limpopo or the Northern Cape do not mean those provinces have few bottle stores.');

  const stats = catalogStats(ingest.catalog);
  const addedStats = catalogStats(ingest.added);
  const googleStats = catalogStats(googlePois);

  const byProvinceQueries: Record<string, { points: number; observations: number; states: Record<string, number> }> = {};
  for (const province of SA_PROVINCES) {
    const provinceQueries = checkpoint.queries.filter((q) => q.province === province);
    const states: Record<string, number> = {};
    for (const q of provinceQueries) states[q.state] = (states[q.state] ?? 0) + 1;
    const placeIds = new Set(
      observations.filter((o) => o.province === province).map((o) => o.googlePlaceId)
    );
    byProvinceQueries[province] = {
      points: points.filter((p) => p.province === province).length,
      observations: placeIds.size,
      states,
    };
  }

  const payload: GooglePlacesFile = {
    version: 1,
    generatedAt: new Date().toISOString(),
    pois: googlePois,
    enrichment: [...enrichmentById.values()],
    reviewCandidates: ingest.reviewCandidates,
    audit: {
      existingReviewed: existing.length,
      googleObservations: observations.length,
      existingMatches: ingest.confirmedMatches,
      potentialMatches: ingest.likelyMatches + ingest.possibleMatches,
      likelyMatches: ingest.likelyMatches,
      possibleMatches: ingest.possibleMatches,
      newPoiCandidates: ingest.newPoiCandidates,
      addedPois: ingest.added.length,
      originalIdsPreserved: originalIds.length,
      catalogAfter: ingest.catalog.length,
      queriesByState,
      byProvince: {
        catalog: stats.byProvince,
        added: addedStats.byProvince,
        googleCatalog: googleStats.byProvince,
        queries: byProvinceQueries,
      },
      byCity: addedStats.byCity,
      bySource: stats.bySource,
      limitations,
      provincesQueried: [...covered],
      safety: {
        noDeletions: true,
        originalIdsPreserved: originalIds.every((id) => ingest.catalog.some((poi) => poi.id === id)),
        priorGoogleIdsPreserved: previousGoogleIds.every((id) => googlePois.some((poi) => poi.id === id)),
        nineProvincesInGrid: SA_PROVINCES.every((p) => SA_SEARCH_GRID.some((pt) => pt.province === p)),
        nineProvincesQueried: SA_PROVINCES.every((p) => covered.has(p)),
      },
    },
  };

  atomicWrite(OUT_FILE, `${JSON.stringify(payload, null, 2)}\n`);
  atomicWrite(REPORT_FILE, `${JSON.stringify(payload.audit, null, 2)}\n`);

  console.log('\n=== Google Places audit ===');
  console.log(`Existing POIs reviewed:     ${existing.length}`);
  console.log(`Google observations:        ${observations.length}`);
  console.log(`Existing matches confirmed: ${ingest.confirmedMatches}`);
  console.log(`Potential matches (review): ${ingest.likelyMatches + ingest.possibleMatches} (likely ${ingest.likelyMatches}, possible ${ingest.possibleMatches})`);
  console.log(`New POI candidates:         ${ingest.newPoiCandidates}`);
  console.log(`Added POIs:                 ${ingest.added.length}`);
  console.log(`Catalog after (additive):   ${ingest.catalog.length}`);
  console.log('\nCatalog by province:');
  for (const province of [...SA_PROVINCES, 'unknown']) {
    const n = stats.byProvince[province] ?? 0;
    const added = addedStats.byProvince[province] ?? 0;
    if (n || added) console.log(`  ${province}: ${n} total, +${added} new`);
  }
  console.log('\nQuery states:', queriesByState);
  console.log(`Wrote ${OUT_FILE}`);
  console.log(`Wrote ${REPORT_FILE}`);

  if (!payload.audit || typeof payload.audit !== 'object') return;
  const safety = (payload.audit as { safety: Record<string, boolean> }).safety;
  if (!safety.noDeletions || !safety.originalIdsPreserved || !safety.priorGoogleIdsPreserved) {
    console.error('SAFETY CHECK FAILED — refusing to treat this as success');
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
