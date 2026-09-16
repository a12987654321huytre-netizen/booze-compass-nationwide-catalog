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
  /** Raw store list from the last query (before distance/bearing overlay). */
  const lastRawStoresRef = useRef<LiquorStore[]>([]);

  const runQuery = useCallback(async (pos: GeoPosition, radiusMeters: number) => {
    const generation = ++generationRef.current;
    const local = discoverLocal(pos.latitude, pos.longitude, radiusMeters);
    const haveLocal = local.stores.length > 0;

    if (haveLocal) {
      lastRawStoresRef.current = local.stores;
      lastQueryPosRef.current = pos;
      setStores(applyDistancesAndSort(local.stores, pos));
      setUsingCache(local.meta.fromCache && local.meta.cacheStale);
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
        setUsingCache(true);
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

    // First query, or user widened the net → always run a full query.
    const mustQuery =
      last === null ||
      // radiusIndex change is handled by comparing whether we still have data;
      // we always re-query when radiusIndex changes via the dependency array,
      // but only if we moved far enough OR we never queried at this radius yet.
      false;

    // Distance since the last *full* query. CONFIG.refreshDistanceMeters is
    // the intentional threshold so tiny GPS noise does not reshuffle the UI.
    const movedMeters =
      last === null
        ? Infinity
        : getDistanceMeters(last.latitude, last.longitude, position.latitude, position.longitude);

    const radiusChanged = true; // radiusIndex is in the dep array; we detect via last query

    // Track which radius we last queried so a widen always triggers a new search.
    // Stored on the ref object as a side field to avoid extra state churn.
    type PosWithRadius = GeoPosition & { _radius?: number };
    const lastWithRadius = last as PosWithRadius | null;
    const lastRadius = lastWithRadius?._radius;
    const radiusNeedsQuery = lastRadius !== requestedRadius;

    if (mustQuery || last === null || movedMeters >= CONFIG.refreshDistanceMeters || radiusNeedsQuery) {
      void runQuery(position, requestedRadius).then(() => {
        // Tag the last query position with the radius we used.
        if (lastQueryPosRef.current) {
          (lastQueryPosRef.current as PosWithRadius)._radius = requestedRadius;
        }
      });
      return;
    }

    // Small GPS drift: only refresh distance/bearing on the existing list.
    // Do not re-rank in a way that swaps the primary store every few metres —
    // re-sort is fine (nearest stays nearest if you barely moved) but we avoid
    // blowing away selection by not changing store identity from a full refetch.
    if (lastRawStoresRef.current.length > 0) {
      setStores(applyDistancesAndSort(lastRawStoresRef.current, position));
    }
  }, [position?.latitude, position?.longitude, radiusIndex, runQuery, position]);

  const refresh = useCallback(() => {
    if (!position) return;
    lastQueryPosRef.current = null;
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
