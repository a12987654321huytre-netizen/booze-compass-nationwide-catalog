import type { DiscoveredCandidate, LiquorStore, LiquorStoreProvider } from '../types/store';
import { CONFIG } from './config';
import { resolveAddress } from './osmFormat';
import type { OsmTags } from './osmFormat';
import { buildLiquorNameRegex } from './liquorMatching';
import { scoreLiquorCandidate, LIQUOR_CONFIDENCE_THRESHOLD } from './liquorScoring';
import type { LiquorScoreResult } from './liquorScoring';
import { resolveStoreIdentity } from './liquorIdentity';

export type OverpassElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: OsmTags;
};

type OverpassResponse = {
  elements: OverpassElement[];
};

/**
 * Keep this query cheap on public Overpass.
 *
 * We do NOT dump every nearby supermarket. A 5 km supermarket dump is
 * what made the old query hang. Instead:
 *   1. explicit alcohol/wine retail tags
 *   2. any shop that explicitly tags alcohol=yes (attached counters)
 *   3. shop-tagged elements whose name/brand/official_name/alt_name
 *      looks like a liquor retailer
 *
 * operator is intentionally not in the server-side regex — too many
 * "Shoprite Holdings" false positives. Identity still inspects it.
 */
export function buildQuery(lat: number, lon: number, radiusMeters: number): string {
  const around = `around:${radiusMeters},${lat},${lon}`;
  const nameRegex = buildLiquorNameRegex();
  const nameKeys = '^(name|name:en|brand|official_name|alt_name|short_name)$';

  const filters = [
    `nwr["shop"="alcohol"](${around});`,
    `nwr["shop"="wine"](${around});`,
    `nwr["shop"="beverages"]["alcohol"="yes"](${around});`,
    `nwr["shop"]["alcohol"="yes"](${around});`,
    `nwr["shop"][~"${nameKeys}"~"${nameRegex}",i](${around});`,
  ].join('\n      ');

  return `
    [out:json][timeout:${Math.round(CONFIG.overpassTimeoutMs / 1000)}];
    (
      ${filters}
    );
    out center tags;
  `.trim();
}

export type DebugCandidate = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  rawTags: OsmTags;
  score: LiquorScoreResult;
  identitySource?: string;
  alternativeNames?: string[];
  source?: DiscoveredCandidate['source'];
};

function elementCoords(element: OverpassElement): { lat: number; lon: number } | null {
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  if (lat == null || lon == null) return null;
  return { lat, lon };
}

export function dedupeElements(elements: OverpassElement[]): OverpassElement[] {
  const seen = new Set<string>();
  const result: OverpassElement[] = [];
  for (const element of elements) {
    const key = `${element.type}-${element.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(element);
  }
  return result;
}

export function elementToCandidate(
  element: OverpassElement,
  source: DiscoveredCandidate['source'] = 'osm'
): DiscoveredCandidate | null {
  const coords = elementCoords(element);
  if (!coords) return null;
  const tags = element.tags ?? {};
  const identity = resolveStoreIdentity(tags, { classifiedAsLiquor: true });
  const score = scoreLiquorCandidate(tags, identity.name);
  return {
    id: `${source}-${element.type}-${element.id}`,
    latitude: coords.lat,
    longitude: coords.lon,
    rawTags: tags,
    score,
    source,
    osmId: `osm-${element.type}-${element.id}`,
  };
}

async function fetchFromEndpoint(
  endpoint: string,
  query: string,
  signal: AbortSignal
): Promise<OverpassResponse> {
  const response = await fetch(endpoint, {
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Overpass endpoint ${endpoint} returned ${response.status}`);
  }
  return (await response.json()) as OverpassResponse;
}

/**
 * Race every configured mirror. First successful JSON wins; the others
 * are aborted. This is the difference between "12s then 12s then 12s"
 * and "the one mirror that's actually up answers in 600ms".
 */
export async function raceOverpassQuery(query: string): Promise<OverpassElement[]> {
  const controllers = CONFIG.overpassEndpoints.map(() => new AbortController());
  const timeout = setTimeout(() => {
    for (const c of controllers) c.abort();
  }, CONFIG.overpassTimeoutMs);

  const attempts = CONFIG.overpassEndpoints.map((endpoint, i) =>
    fetchFromEndpoint(endpoint, query, controllers[i].signal).then((data) => ({
      endpoint,
      data,
    }))
  );

  try {
    const winner = await Promise.any(attempts);
    for (const c of controllers) c.abort();
    return dedupeElements(winner.data.elements ?? []);
  } catch (err) {
    const message =
      err instanceof AggregateError
        ? 'All Overpass endpoints failed'
        : err instanceof Error
          ? err.message
          : 'All Overpass endpoints failed';
    throw new Error(message);
  } finally {
    clearTimeout(timeout);
  }
}

export async function runOverpassQuery(
  latitude: number,
  longitude: number,
  radiusMeters: number
): Promise<OverpassElement[]> {
  const query = buildQuery(latitude, longitude, radiusMeters);

  // Prefer our same-origin proxy so the browser makes one request and
  // the server races the mirrors. Fall back to a direct race if the
  // proxy is missing (static preview, tests).
  if (typeof window !== 'undefined') {
    try {
      const proxied = await fetch('/api/overpass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(CONFIG.overpassTimeoutMs + 1500),
      });
      if (proxied.ok) {
        const data = (await proxied.json()) as OverpassResponse;
        if (Array.isArray(data.elements)) return dedupeElements(data.elements);
      }
    } catch {
      // Proxy down — race the public mirrors from the client.
    }
  }

  return raceOverpassQuery(query);
}

function candidateToStore(candidate: DiscoveredCandidate): LiquorStore {
  const identity = resolveStoreIdentity(candidate.rawTags, {
    classifiedAsLiquor: candidate.score.accepted,
  });
  return {
    id: candidate.id,
    name: identity.name,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    openingHours: candidate.rawTags.opening_hours,
    address: resolveAddress(candidate.rawTags),
    source: candidate.source,
    locationType: identity.locationType,
    parentName: identity.parentName,
    brand: identity.brand,
    matchConfidence: candidate.score.score,
    matchReasons: candidate.score.reasons.map((r) => r.signal),
    alternativeNames: identity.alternativeNames,
    identitySource: identity.identitySource,
    osmId: candidate.osmId,
  };
}

/**
 * Live Overpass-backed provider. Classification happens here so the
 * debug CLI can inspect accept/reject reasoning; identity + ranking
 * still run in the discovery orchestrator when used through it.
 */
export class OverpassLiquorStoreProvider implements LiquorStoreProvider {
  async findNearby(
    latitude: number,
    longitude: number,
    radiusMeters: number
  ): Promise<LiquorStore[]> {
    const elements = await runOverpassQuery(latitude, longitude, radiusMeters);
    const stores: LiquorStore[] = [];
    for (const element of elements) {
      const candidate = elementToCandidate(element, 'osm');
      if (!candidate || !candidate.score.accepted) continue;
      stores.push(candidateToStore(candidate));
    }
    return stores;
  }

  async findNearbyDebug(
    latitude: number,
    longitude: number,
    radiusMeters: number
  ): Promise<DebugCandidate[]> {
    const elements = await runOverpassQuery(latitude, longitude, radiusMeters);
    const out: DebugCandidate[] = [];
    for (const element of elements) {
      const candidate = elementToCandidate(element, 'osm');
      if (!candidate) continue;
      const identity = resolveStoreIdentity(candidate.rawTags, {
        classifiedAsLiquor: candidate.score.accepted,
      });
      out.push({
        id: candidate.id,
        name: identity.name,
        latitude: candidate.latitude,
        longitude: candidate.longitude,
        rawTags: candidate.rawTags,
        score: candidate.score,
        identitySource: identity.identitySource,
        alternativeNames: identity.alternativeNames,
        source: 'osm',
      });
    }
    return out.sort((a, b) => b.score.score - a.score.score);
  }
}

export { LIQUOR_CONFIDENCE_THRESHOLD };
