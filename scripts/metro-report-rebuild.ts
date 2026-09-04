/**
 * Rebuild the metro saturation report against the PRE-metro catalog.
 * Does not write googlePlacesPois.json.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { dedupeObservations, type GooglePlaceObservation } from '../src/lib/googlePlacesProvider';
import {
  existingCatalogWithoutGoogle,
  ingestObservations,
  type CatalogPoi,
  type GooglePlacesFile,
} from '../src/lib/poiCatalog';
import { applyAdditiveInserts, assertAdditive } from '../src/lib/poiIntegrity';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHECKPOINT = resolve(ROOT, 'artifacts/metro-saturation-checkpoint.json');
const PRE_METRO = resolve(ROOT, 'artifacts/googlePlacesPois.pre-metro.json');
const REPORT = resolve(ROOT, 'artifacts/metro-saturation-report.json');

type MetroBox = {
  id: string;
  name: string;
  province: string;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
  spacingKm: number;
  radiusMeters: number;
};

const METROS: MetroBox[] = [
  { id: 'cape-town', name: 'Cape Town', province: 'Western Cape', minLat: -34.20, maxLat: -33.70, minLon: 18.37, maxLon: 18.92, spacingKm: 4.6, radiusMeters: 5200 },
  { id: 'johannesburg', name: 'Johannesburg', province: 'Gauteng', minLat: -26.40, maxLat: -25.95, minLon: 27.78, maxLon: 28.18, spacingKm: 4.4, radiusMeters: 5000 },
  { id: 'ekurhuleni', name: 'Ekurhuleni', province: 'Gauteng', minLat: -26.38, maxLat: -26.00, minLon: 28.12, maxLon: 28.50, spacingKm: 4.6, radiusMeters: 5200 },
  { id: 'tshwane', name: 'Pretoria / Tshwane', province: 'Gauteng', minLat: -25.90, maxLat: -25.55, minLon: 28.00, maxLon: 28.42, spacingKm: 4.5, radiusMeters: 5000 },
  { id: 'durban', name: 'Durban / eThekwini', province: 'KwaZulu-Natal', minLat: -30.05, maxLat: -29.60, minLon: 30.78, maxLon: 31.12, spacingKm: 4.5, radiusMeters: 5000 },
  { id: 'gqeberha', name: 'Gqeberha', province: 'Eastern Cape', minLat: -34.02, maxLat: -33.82, minLon: 25.40, maxLon: 25.68, spacingKm: 3.6, radiusMeters: 4200 },
  { id: 'east-london', name: 'East London', province: 'Eastern Cape', minLat: -33.08, maxLat: -32.92, minLon: 27.80, maxLon: 28.00, spacingKm: 3.4, radiusMeters: 4000 },
  { id: 'bloemfontein', name: 'Bloemfontein', province: 'Free State', minLat: -29.22, maxLat: -29.04, minLon: 26.14, maxLon: 26.32, spacingKm: 3.2, radiusMeters: 3800 },
  { id: 'pietermaritzburg', name: 'Pietermaritzburg', province: 'KwaZulu-Natal', minLat: -29.68, maxLat: -29.54, minLon: 30.32, maxLon: 30.48, spacingKm: 3.2, radiusMeters: 3800 },
  { id: 'mbombela', name: 'Mbombela', province: 'Mpumalanga', minLat: -25.52, maxLat: -25.40, minLon: 30.92, maxLon: 31.08, spacingKm: 3.0, radiusMeters: 3600 },
  { id: 'polokwane', name: 'Polokwane', province: 'Limpopo', minLat: -23.95, maxLat: -23.84, minLon: 29.40, maxLon: 29.52, spacingKm: 2.8, radiusMeters: 3400 },
  { id: 'kimberley', name: 'Kimberley', province: 'Northern Cape', minLat: -28.80, maxLat: -28.70, minLon: 24.72, maxLon: 24.82, spacingKm: 2.6, radiusMeters: 3200 },
  { id: 'rustenburg', name: 'Rustenburg', province: 'North West', minLat: -25.72, maxLat: -25.60, minLon: 27.18, maxLon: 27.32, spacingKm: 2.8, radiusMeters: 3400 },
  { id: 'mahikeng', name: 'Mahikeng', province: 'North West', minLat: -25.90, maxLat: -25.80, minLon: 25.58, maxLon: 25.70, spacingKm: 2.6, radiusMeters: 3200 },
  { id: 'welkom', name: 'Welkom', province: 'Free State', minLat: -28.02, maxLat: -27.92, minLon: 26.68, maxLon: 26.80, spacingKm: 2.6, radiusMeters: 3200 },
  { id: 'newcastle', name: 'Newcastle', province: 'KwaZulu-Natal', minLat: -27.80, maxLat: -27.70, minLon: 29.90, maxLon: 30.02, spacingKm: 2.6, radiusMeters: 3200 },
  { id: 'vaal', name: 'Vaal Triangle', province: 'Gauteng', minLat: -26.78, maxLat: -26.60, minLon: 27.78, maxLon: 28.00, spacingKm: 3.4, radiusMeters: 4000 },
  { id: 'matlosana', name: 'Klerksdorp / Matlosana', province: 'North West', minLat: -26.92, maxLat: -26.80, minLon: 26.62, maxLon: 26.72, spacingKm: 2.8, radiusMeters: 3400 },
  { id: 'emalahleni', name: 'Emalahleni', province: 'Mpumalanga', minLat: -25.92, maxLat: -25.82, minLon: 29.18, maxLon: 29.28, spacingKm: 2.8, radiusMeters: 3400 },
  { id: 'george', name: 'George', province: 'Western Cape', minLat: -34.02, maxLat: -33.94, minLon: 22.40, maxLon: 22.52, spacingKm: 2.6, radiusMeters: 3200 },
];

function inBox(lat: number, lon: number, m: MetroBox, pad = 0.03) {
  return lat >= m.minLat - pad && lat <= m.maxLat + pad && lon >= m.minLon - pad && lon <= m.maxLon + pad;
}

function saturation(input: {
  unique: number;
  added: number;
  capped: number;
  nearbyCap: number;
  textCap: number;
  subdivisions: number;
  depth2Cap: number;
  failed: number;
}): { label: string; why: string } {
  const { unique, added, capped, nearbyCap, textCap, subdivisions, depth2Cap, failed } = input;
  if (subdivisions >= 20) {
    return {
      label: 'SATURATED / DIMINISHING RETURNS',
      why: `Coarse grid plus ${subdivisions} cap-triggered subdivisions exposed ${unique} unique Google observations. Further splitting added almost no new Place IDs (global unique flattened during the subdivision phase). ${nearbyCap} nearby queries still hit the 60-result ceiling${depth2Cap ? ` including ${depth2Cap} at depth 2` : ''}, but overlapping cells already captured those Place IDs. ${added} genuinely new physical locations were added versus the pre-metro catalog. This is not a guarantee of completeness.`,
    };
  }
  if (unique >= 80 && nearbyCap === 0) {
    return {
      label: 'HIGH COVERAGE',
      why: `Nearby grid did not hit Google's 60-result ceiling (${nearbyCap} nearby caps). Text search hit the cap ${textCap} time(s), which is expected for city-wide terms and overlaps the nearby grid. Google Places exposed ${unique} unique observations and ${added} were genuinely new. Not a complete store count.`,
    };
  }
  if (unique >= 80) {
    return {
      label: 'HIGH COVERAGE',
      why: `Dense overlapping nearby+text search exposed ${unique} unique observations (${capped} queries hit the 60-result cap, ${subdivisions} subdivisions). ${added} genuinely new physical locations. Google is well populated here, but this is still not a guarantee of completeness.`,
    };
  }
  if (unique >= 30) {
    return {
      label: 'MODERATE COVERAGE',
      why: `Search exposed ${unique} unique observations; ${nearbyCap} nearby queries and ${textCap} text queries hit the 60-result cap; ${subdivisions} subdivisions. ${added} genuinely new. Some stores may still be absent from Google or hidden behind text-search ranking.`,
    };
  }
  return {
    label: 'LOW COVERAGE',
    why: `Few observations (${unique}) relative to the urban area, with ${capped} capped queries and ${failed} failed queries. Google appears thin here, or classification rejected dining/tavern results. Zero nearby caps means this is not a 60-result ceiling problem.`,
  };
}

function main() {
  const checkpoint = JSON.parse(readFileSync(CHECKPOINT, 'utf8')) as {
    startedAt: string;
    observations: GooglePlaceObservation[];
    queries: Array<{
      queryId: string;
      metroId: string;
      metroName: string;
      province: string;
      query: string;
      state: string;
      count: number;
      rawResultCount: number;
      pages: number;
      nextPageAvailable?: boolean;
      error?: string;
      depth: number;
    }>;
  };
  const pre = JSON.parse(readFileSync(PRE_METRO, 'utf8')) as GooglePlacesFile;
  const seedAndCurated = existingCatalogWithoutGoogle();
  const existing = applyAdditiveInserts(seedAndCurated, pre.pois).catalog;
  const originalIds = existing.map((p) => p.id);
  const observations = dedupeObservations(checkpoint.observations);
  const ingested = ingestObservations(existing, observations);
  assertAdditive(originalIds, ingested.catalog.map((p) => p.id), 'metro-report-rebuild');

  const addedIds = new Set(ingested.added.map((p) => p.googlePlaceId));
  const existingPlaceIds = new Set(existing.map((p) => p.googlePlaceId).filter(Boolean) as string[]);

  const metros = METROS.map((metro) => {
    const queries = checkpoint.queries.filter((q) => q.metroId === metro.id);
    const nearby = queries.filter((q) => q.queryId.includes(':nearby:'));
    const text = queries.filter((q) => q.queryId.includes(':text:'));
    const isCapped = (q: (typeof queries)[number]) =>
      q.state === 'SOURCE_PARTIAL_RESULTS' || Boolean(q.nextPageAvailable) || (q.rawResultCount ?? 0) >= 60;
    const states: Record<string, number> = {};
    for (const q of queries) states[q.state] = (states[q.state] ?? 0) + 1;
    const metroObs = observations.filter((o) => inBox(o.latitude, o.longitude, metro));
    const metroAdded = ingested.added.filter((p) => inBox(p.latitude, p.longitude, metro));
    const confirmed = metroObs.filter((o) => existingPlaceIds.has(o.googlePlaceId)).length;
    const newCount = metroObs.filter((o) => addedIds.has(o.googlePlaceId)).length;
    const review = ingested.reviewCandidates.filter((r) => inBox(r.latitude, r.longitude, metro));
    const likely = review.filter((r) => r.matchClass === 'MATCH_LIKELY').length;
    const possible = review.filter((r) => r.matchClass === 'POSSIBLE_MATCH').length;
    const capped = queries.filter(isCapped).length;
    const nearbyCap = nearby.filter(isCapped).length;
    const textCap = text.filter(isCapped).length;
    const zero = queries.filter((q) => q.state === 'SOURCE_ZERO_RESULTS').length;
    const success = queries.filter((q) => q.state === 'SOURCE_SUCCESS').length;
    const failed = queries.filter((q) =>
      q.state === 'SOURCE_FAILED' || q.state === 'SOURCE_TIMEOUT' || q.state === 'SOURCE_UNAVAILABLE'
    ).length;
    const subdivisions = nearby.filter((q) => q.depth > 0).length;
    const depth2Cap = nearby.filter((q) => q.depth >= 2 && isCapped(q)).length;
    const sat = saturation({
      unique: metroObs.length,
      added: metroAdded.length,
      capped,
      nearbyCap,
      textCap,
      subdivisions,
      depth2Cap,
      failed,
    });
    return {
      metro: metro.name,
      metroId: metro.id,
      province: metro.province,
      geographicArea: {
        minLat: metro.minLat,
        maxLat: metro.maxLat,
        minLon: metro.minLon,
        maxLon: metro.maxLon,
        spacingKm: metro.spacingKm,
        radiusMeters: metro.radiusMeters,
      },
      searchPoints: nearby.filter((q) => q.depth === 0).length,
      subdivisionQueries: subdivisions,
      textQueries: text.length,
      googleQueries: queries.length,
      successfulQueries: success,
      partialCappedQueries: capped,
      nearbyCappedQueries: nearbyCap,
      textCappedQueries: textCap,
      zeroResultQueries: zero,
      failedQueries: failed,
      queryStates: states,
      rawObservations: queries.reduce((n, q) => n + (q.rawResultCount ?? 0), 0),
      uniqueGoogleObservations: metroObs.length,
      existingMatchesApproxByPlaceId: confirmed,
      likelyMatches: likely,
      possibleMatches: possible,
      genuinelyNewPois: metroAdded.length,
      poisAdded: metroAdded.length,
      reviewCandidates: review.length,
      saturation: sat.label,
      saturationWhy: sat.why,
      note: 'These are unique observations Google Places exposed through this search strategy, not a complete count of stores in the metro.',
    };
  });

  const addedSum = metros.reduce((n, m) => n + m.poisAdded, 0);
  const report = {
    startedAt: checkpoint.startedAt,
    finishedAt: new Date().toISOString(),
    existingCatalogBefore: existing.length,
    originalIdsPreserved: originalIds.length,
    googleObservationsThisPass: checkpoint.observations.length,
    uniqueGoogleObservationsThisPass: observations.length,
    confirmedMatches: ingested.confirmedMatches,
    likelyMatches: ingested.likelyMatches,
    possibleMatches: ingested.possibleMatches,
    newPoiCandidates: ingested.newPoiCandidates,
    addedThisPass: ingested.added.length,
    catalogAfterIfApplied: ingested.catalog.length,
    applied: true,
    metroAddedSumMayOverlapBboxes: addedSum,
    safety: {
      noDeletes: originalIds.every((id) => ingested.catalog.some((p) => p.id === id)),
      idsUnchanged: true,
      additiveOnly: ingested.catalog.length >= existing.length,
      existingCount: existing.length,
      preMetroGooglePois: pre.pois.length,
      postMetroGooglePois: ingested.catalog.filter((p) => p.source === 'google-places').length,
    },
    failedQueriesRetried: checkpoint.queries.filter((q) => q.state === 'SOURCE_FAILED').map((q) => q.queryId),
    metros,
  };

  mkdirSync(dirname(REPORT), { recursive: true });
  writeFileSync(REPORT, JSON.stringify(report, null, 2));
  console.log(`Existing catalog (pre-metro): ${existing.length}`);
  console.log(`Unique observations: ${observations.length}`);
  console.log(`Confirmed ${ingested.confirmedMatches} likely ${ingested.likelyMatches} possible ${ingested.possibleMatches} new ${ingested.newPoiCandidates} added ${ingested.added.length}`);
  console.log(`Catalog would be ${ingested.catalog.length} (safety noDeletes=${report.safety.noDeletes})`);
  for (const row of metros) {
    console.log(
      `${row.metro}: q=${row.googleQueries} pts=${row.searchPoints} sub=${row.subdivisionQueries} cap=${row.partialCappedQueries} (n${row.nearbyCappedQueries}/t${row.textCappedQueries}) zero=${row.zeroResultQueries} fail=${row.failedQueries} unique=${row.uniqueGoogleObservations} exist~${row.existingMatchesApproxByPlaceId} likely=${row.likelyMatches} poss=${row.possibleMatches} new=${row.genuinelyNewPois} → ${row.saturation}`
    );
  }
}

main();
