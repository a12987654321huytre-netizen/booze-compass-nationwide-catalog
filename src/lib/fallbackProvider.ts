import type { LiquorStore } from '../types/store';

/**
 * Optional paid fallback (Google Places or similar).
 *
 * THIS DOES NOT FIRE ON APP OPEN.
 *
 * Google Places terms (as of 2026):
 * - Place IDs may be stored indefinitely.
 * - Lat/lng from Places may be cached for at most 30 consecutive days,
 *   then must be deleted.
 * - Other Places content must not be pre-fetched, cached, or stored
 *   beyond those exceptions.
 * - You cannot legally build a durable POI database from Places results.
 *
 * Therefore:
 * - No Places request is the default path.
 * - Results, if any, live in a session/24h cache only — never in the
 *   curated JSON, never in the OSM seed, never as a 7-day tile.
 * - The call is server-side, rate-limited per geohash, and only
 *   attempted when free sources produced nothing usable.
 *
 * Concrete fire rules (all must be true):
 *   1. CONFIG.paidFallbackEnabled is true AND a server key exists
 *   2. OSM Overpass completed or timed out
 *   3. Curated + seed + cache produced zero accepted stores in-radius
 *   4. Overpass produced zero accepted stores in-radius
 *   5. This geohash has not already fallen back in the last 24h
 *
 * There is no API key in this workspace, so this function is a no-op.
 */
export type FallbackDecision = {
  fired: boolean;
  reason: string;
  stores: LiquorStore[];
};

export function shouldUsePaidFallback(input: {
  enabled: boolean;
  keyConfigured: boolean;
  acceptedCount: number;
  overpassAttempted: boolean;
}): { ok: boolean; reason: string } {
  if (!input.enabled) return { ok: false, reason: 'paid fallback disabled (default)' };
  if (!input.keyConfigured) return { ok: false, reason: 'no server-side Places key configured' };
  if (!input.overpassAttempted) {
    return { ok: false, reason: 'free sources have not been tried yet' };
  }
  if (input.acceptedCount > 0) {
    return { ok: false, reason: 'free/open data already produced a viable result' };
  }
  return { ok: true, reason: 'zero viable results from OSM + curated + seed' };
}

export async function lookupPaidFallback(_input: {
  latitude: number;
  longitude: number;
  radiusMeters: number;
}): Promise<FallbackDecision> {
  const decision = shouldUsePaidFallback({
    enabled: false,
    keyConfigured: false,
    acceptedCount: 0,
    overpassAttempted: true,
  });
  return { fired: false, reason: decision.reason, stores: [] };
}
