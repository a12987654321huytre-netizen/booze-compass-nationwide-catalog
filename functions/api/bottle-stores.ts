/**
 * Cloudflare Pages Function — GET /api/bottle-stores?lat=&lon=&radius=
 *
 * Live Overpass refresh only. The browser already has the nationwide
 * bundled catalogue; this endpoint is additive. Do not import discovery
 * / poiCatalog here — that pulls multi-MB JSON and blows Worker limits.
 *
 * Opening the app does not call Google Places.
 */

import { runOverpassQuery, elementToCandidate } from '../../src/lib/overpassProvider';
import { resolveStoreIdentity } from '../../src/lib/liquorIdentity';
import { resolveAddress } from '../../src/lib/osmFormat';
import { CONFIG } from '../../src/lib/config';
import type { LiquorStore } from '../../src/types/store';

const CACHE_TTL_SECONDS = Math.round(CONFIG.cacheFreshMs / 1000);
const CACHE_COORD_PRECISION = 3;
const MIN_RADIUS = CONFIG.searchRadiiMeters[0];
const MAX_RADIUS = CONFIG.searchRadiiMeters[CONFIG.searchRadiiMeters.length - 1];

function json(body: unknown, status: number, extra?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extra,
    },
  });
}

function parseBounded(value: string | null, min: number, max: number): number | null {
  if (value === null || value.trim() === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

function cacheKey(request: Request, lat: number, lon: number, radius: number): Request {
  const url = new URL(request.url);
  url.search = '';
  url.searchParams.set('lat', lat.toFixed(CACHE_COORD_PRECISION));
  url.searchParams.set('lon', lon.toFixed(CACHE_COORD_PRECISION));
  url.searchParams.set('radius', String(radius));
  return new Request(url.toString(), { method: 'GET' });
}

function elementToStore(
  element: Parameters<typeof elementToCandidate>[0]
): LiquorStore | null {
  const candidate = elementToCandidate(element, 'osm');
  if (!candidate || !candidate.score.accepted) return null;

  const identity = resolveStoreIdentity(candidate.rawTags, {
    classifiedAsLiquor: true,
  });

  return {
    id: candidate.id,
    name: identity.name,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    openingHours: candidate.rawTags.opening_hours,
    address: resolveAddress(candidate.rawTags),
    source: 'osm',
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

export async function onRequestGet(context: { request: Request }): Promise<Response> {
  const { request } = context;
  const startedAt = Date.now();
  const url = new URL(request.url);

  const lat = parseBounded(url.searchParams.get('lat'), -90, 90);
  const lon = parseBounded(url.searchParams.get('lon'), -180, 180);
  const radius = parseBounded(url.searchParams.get('radius'), MIN_RADIUS, MAX_RADIUS);

  if (lat === null || lon === null || radius === null) {
    return json({ error: 'INVALID_PARAMS' }, 400);
  }

  const key = cacheKey(request, lat, lon, radius);
  try {
    const hit = await caches.default.match(key);
    if (hit) return hit;
  } catch {
    // Cache API optional — non-fatal.
  }

  let stores: LiquorStore[] = [];
  try {
    const elements = await runOverpassQuery(lat, lon, radius);
    for (const element of elements) {
      const store = elementToStore(element);
      if (store) stores.push(store);
    }
  } catch (err) {
    console.error(
      JSON.stringify({
        route: 'bottle-stores',
        outcome: 'overpass_failed',
        latBucket: lat.toFixed(1),
        lonBucket: lon.toFixed(1),
        radius,
        totalDurationMs: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      })
    );
    // Empty list is fine — client keeps the bundled catalogue.
    return json({ stores: [] }, 200, {
      'Cache-Control': 'public, max-age=60',
    });
  }

  console.log(
    JSON.stringify({
      route: 'bottle-stores',
      outcome: 'success',
      latBucket: lat.toFixed(1),
      lonBucket: lon.toFixed(1),
      radius,
      resultCount: stores.length,
      totalDurationMs: Date.now() - startedAt,
    })
  );

  const response = json(
    { stores },
    200,
    { 'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}` }
  );

  try {
    await caches.default.put(key, response.clone());
  } catch {
    // Non-fatal.
  }

  return response;
}

/** Non-GET → 405 */
export async function onRequest(context: { request: Request }): Promise<Response> {
  if (context.request.method === 'GET') {
    return onRequestGet(context);
  }
  return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
}
