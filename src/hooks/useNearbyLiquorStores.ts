import { useCallback, useEffect, useRef, useState } from 'react';
import type { LiquorStore } from '../types/store';
import { ApiLiquorStoreProvider } from '../lib/apiProvider';
import { CONFIG } from '../lib/config';
import { getDistanceMeters, calculateBearing } from '../lib/geo';
import { discoverLocal } from '../lib/discovery';
import { dedupeStores, rankStores } from '../lib/liquorRank';
import type { GeoPosition } from './useGeolocation';

const provider = new ApiLiquorStoreProvider();

type FetchState = 'idle' | 'loading' | 'widening' | 'error' | 'empty' | 'ready';

type UseNearbyLiquorStoresResult = {
  stores: LiquorStore[];
  state: FetchState;
  usingCache: boolean;
  errorMessage: string | null;
  currentRadiusMeters: number;
  nextRadiusMeters: number | null;
  refresh: () => void;
  widenSearch: () => void;
  canWidenFurther: boolean;
};

/** Sources that ship inside the app build — not "yesterday's intel". */
const BUNDLED_SOURCES = new Set([
  'google-places',
  'osm-seed',
  'curated',
  'eclb',
  'wcla',
]);

function hasBundledCatalog(sources: readonly string[] | undefined): boolean {
  if (!sources || sources.length === 0) return false;
  return sources.some((s) => BUNDLED_SOURCES.has(s));
}

/**
 * Banner only when we are genuinely stuck on old localStorage tiles and
 * do not have the nationwide bundled catalogue answering the query.
 * Cloudflare deploys often have no /api/bottle-stores — that must not
 * permanently shame the user with a stale-cache warning.
 */
function shouldShowStaleBanner(meta: {
  fromCache: boolean;
  cacheStale: boolean;
  sourcesUsed?: readonly string[];
}): boolean {
  if (hasBundledCatalog(meta.sourcesUsed)) return false;
  return meta.fromCache && meta.cacheStale;
}

function applyDistancesAndSort(rawStores: LiquorStore[], pos: GeoPosition): LiquorStore[] {
  return rankStores(
    rawStores.map((store) => ({
      ...store,
      locationType: store.locationType ?? 'standalone',
      distanceMeters: getDistanceMeters(
        pos.latitude,
        pos.longitude,
        store.latitude,
        store.longitude
      ),
      bearingDegrees: calculateBearing(
        pos.latitude,
        pos.longitude,
        store.latitude,
        store.longitude
      ),
    }))
  );
}

function mergeAdditive(local: LiquorStore[], remote: LiquorStore[]): LiquorStore[] {
  return dedupeStores([...local, ...remote]);
}

export function useNearbyLiquorStores(
  position: GeoPosition | null
): UseNearbyLiquorStoresResult {
  const [stores, setStores] = useState<LiquorStore[]>([]);
  const [state, setState] = useState<FetchState>('idle');
  const [usingCache, setUsingCache] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [radiusIndex, setRadiusIndex] = useState(0);
  const generationRef = useRef(0);
  /** Last position we actually ran a catalog/network query against. */
  const lastQueryPosRef = useRef<GeoPosition | null>(null);
  /** Radius used for that last full query. */
  const lastQueryRadiusRef = useRef<number | null>(null);
  /** Raw store list from the last query (before distance/bearing overlay). */
  const lastRawStoresRef = useRef<LiquorStore[]>([]);

  const runQuery = useCallback(async (pos: GeoPosition, radiusMeters: number) => {
    const generation = ++generationRef.current;
    // Mark query parameters immediately so effect re-runs during the async
    // work do not kick off a duplicate full search.
    lastQueryPosRef.current = pos;
    lastQueryRadiusRef.current = radiusMeters;

    const local = discoverLocal(pos.latitude, pos.longitude, radiusMeters);
    const haveLocal = local.stores.length > 0;

    if (haveLocal) {
      lastRawStoresRef.current = local.stores;
      setStores(applyDistancesAndSort(local.stores, pos));
      setUsingCache(shouldShowStaleBanner(local.meta));
      setState('ready');
      setErrorMessage(null);
    } else {
      setState((prev) => (prev === 'ready' ? 'widening' : 'loading'));
    }

    try {
      const remote = await provider.findNearby(pos.latitude, pos.longitude, radiusMeters);
      if (generation !== generationRef.current) return;

      const merged = mergeAdditive(local.stores, remote);
      lastRawStoresRef.current = merged;
      lastQueryPosRef.current = pos;
      lastQueryRadiusRef.current = radiusMeters;
      const ranked = applyDistancesAndSort(merged, pos);
      if (ranked.length > 0) {
        setStores(ranked);
        setUsingCache(false);
        setState('ready');
        setErrorMessage(null);
        return;
      }

      if (haveLocal) return;

      const nextIndex = CONFIG.searchRadiiMeters.indexOf(radiusMeters) + 1;
      if (nextIndex < CONFIG.searchRadiiMeters.length) {
        setRadiusIndex(nextIndex);
        return;
      }
      setStores([]);
      lastRawStoresRef.current = [];
      setState('empty');
    } catch {
      if (generation !== generationRef.current) return;
      if (haveLocal) {
        // Network refresh failed (common on Cloudflare without a Pages Function).
        // Keep serving the bundled catalogue without the stale-cache scare banner.
        setUsingCache(shouldShowStaleBanner(local.meta));
        setState('ready');
        return;
      }
      setState('error');
      setErrorMessage("Couldn't reach the map data. Check your connection and try again.");
    }
  }, []);

  useEffect(() => {
    if (!position) return;

    const requestedRadius = CONFIG.searchRadiiMeters[radiusIndex] ?? CONFIG.initialRadiusMeters;
    const last = lastQueryPosRef.current;

    const movedMeters =
      last === null
        ? Infinity
        : getDistanceMeters(last.latitude, last.longitude, position.latitude, position.longitude);

    const radiusNeedsQuery = lastQueryRadiusRef.current !== requestedRadius;

    // Full catalog/network search only when:
    // - first fix
    // - user moved far from the last query point
    // - search radius changed (widen / refresh)
    if (last === null || movedMeters >= CONFIG.refreshDistanceMeters || radiusNeedsQuery) {
      void runQuery(position, requestedRadius);
      return;
    }

    // Tiny GPS drift: update distance + bearing only. No reshuffle of identity.
    if (lastRawStoresRef.current.length > 0) {
      setStores(applyDistancesAndSort(lastRawStoresRef.current, position));
    }
  }, [position?.latitude, position?.longitude, radiusIndex, runQuery, position]);

  const refresh = useCallback(() => {
    if (!position) return;
    lastQueryPosRef.current = null;
    lastQueryRadiusRef.current = null;
    setRadiusIndex(0);
    void runQuery(position, CONFIG.searchRadiiMeters[0]);
  }, [position, runQuery]);

  const widenSearch = useCallback(() => {
    setRadiusIndex((prev) => Math.min(prev + 1, CONFIG.searchRadiiMeters.length - 1));
  }, []);

  const canWidenFurther = radiusIndex < CONFIG.searchRadiiMeters.length - 1;
  const nextRadiusMeters = canWidenFurther ? CONFIG.searchRadiiMeters[radiusIndex + 1] : null;

  return {
    stores,
    state,
    usingCache,
    errorMessage,
    currentRadiusMeters: CONFIG.searchRadiiMeters[radiusIndex] ?? CONFIG.initialRadiusMeters,
    nextRadiusMeters,
    refresh,
    widenSearch,
    canWidenFurther,
  };
}
