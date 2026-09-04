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

  const runQuery = useCallback(async (pos: GeoPosition, radiusMeters: number) => {
    const generation = ++generationRef.current;
    const local = discoverLocal(pos.latitude, pos.longitude, radiusMeters);
    const haveLocal = local.stores.length > 0;

    if (haveLocal) {
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

      const merged = applyDistancesAndSort(mergeAdditive(local.stores, remote), pos);
      if (merged.length > 0) {
        setStores(merged);
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
    void runQuery(position, requestedRadius);
  }, [position?.latitude, position?.longitude, radiusIndex, runQuery, position]);

  const refresh = useCallback(() => {
    if (!position) return;
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
