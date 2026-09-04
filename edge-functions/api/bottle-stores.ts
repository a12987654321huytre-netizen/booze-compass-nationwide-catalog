// EdgeOne bottle-store API.
//
// Catalog (seed + curated + Google Places discoveries) is the durable
// database. Overpass is additive live refresh. A thin Overpass result
// never replaces the catalog — that was the production bug.
//
// The browser never talks to public Overpass mirrors (Safari CORS).
// Opening the app does not call Google Places.

import { discoverLocal, discoverRefresh } from '../../src/lib/discovery';
import { CONFIG } from '../../src/lib/config';

type EdgeOneEventContext = {
  request: Request;
  env: Record<string, unknown>;
};

const CACHE_NAME = 'bottle-stores-v2';
const CACHE_TTL_SECONDS = Math.round(CONFIG.cacheMaxAgeMs / 1000);
const CACHE_COORD_PRECISION = 3;
const MIN_RADIUS_METERS = CONFIG.searchRadiiMeters[0];
const MAX_RADIUS_METERS = CONFIG.searchRadiiMeters[CONFIG.searchRadiiMeters.length - 1];

function jsonResponse(
  body: unknown,
  status: number,
  extraHeaders?: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

function parseBoundedNumber(value: string | null, min: number, max: number): number | null {
  if (value === null || value.trim() === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

function buildCacheKey(request: Request, lat: number, lon: number, radius: number): Request {
  const url = new URL(request.url);
  url.search = '';
  url.searchParams.set('lat', lat.toFixed(CACHE_COORD_PRECISION));
  url.searchParams.set('lon', lon.toFixed(CACHE_COORD_PRECISION));
  url.searchParams.set('radius', String(radius));
  return new Request(url.toString(), { method: 'GET' });
}

export async function onRequest(context: EdgeOneEventContext): Promise<Response> {
  const { request } = context;

  if (request.method !== 'GET') {
    return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);
  }

  const startedAt = Date.now();
  const url = new URL(request.url);

  const lat = parseBoundedNumber(url.searchParams.get('lat'), -90, 90);
  const lon = parseBoundedNumber(url.searchParams.get('lon'), -180, 180);
  const radius = parseBoundedNumber(
    url.searchParams.get('radius'),
    MIN_RADIUS_METERS,
    MAX_RADIUS_METERS
  );

  if (lat === null || lon === null || radius === null) {
    return jsonResponse({ error: 'INVALID_PARAMS' }, 400);
  }

  let cache: Cache | null = null;
  let cacheKey: Request | null = null;
  try {
    cache = await caches.open(CACHE_NAME);
    cacheKey = buildCacheKey(request, lat, lon, radius);
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
  } catch {
    cache = null;
  }

  const local = discoverLocal(lat, lon, radius);

  let stores = local.stores;
  let overpassSucceeded = false;
  try {
    const fresh = await discoverRefresh(lat, lon, radius);
    overpassSucceeded = fresh.meta.overpassSucceeded;
    if (fresh.stores.length > 0) {
      stores = fresh.stores;
    }
  } catch (err) {
    if (local.stores.length === 0) {
      console.error(
        JSON.stringify({
          route: 'bottle-stores',
          outcome: 'all_sources_failed',
          latBucket: lat.toFixed(1),
          lonBucket: lon.toFixed(1),
          radius,
          totalDurationMs: Date.now() - startedAt,
          error: err instanceof Error ? err.message : String(err),
        })
      );
      return jsonResponse({ error: 'UPSTREAM_UNAVAILABLE' }, 502);
    }
  }

  if (stores.length === 0) {
    return jsonResponse({ error: 'UPSTREAM_UNAVAILABLE' }, 502);
  }

  console.log(
    JSON.stringify({
      route: 'bottle-stores',
      outcome: 'success',
      latBucket: lat.toFixed(1),
      lonBucket: lon.toFixed(1),
      radius,
      resultCount: stores.length,
      catalogCount: local.stores.length,
      overpassSucceeded,
      totalDurationMs: Date.now() - startedAt,
    })
  );

  const response = jsonResponse({ stores }, 200, {
    'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
  });

  if (cache && cacheKey) {
    try {
      await cache.put(cacheKey, response.clone());
    } catch {
      // Non-fatal.
    }
  }

  return response;
}
