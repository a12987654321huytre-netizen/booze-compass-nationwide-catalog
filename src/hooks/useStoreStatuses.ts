import { useEffect, useRef, useState } from 'react';
import type { LiquorStore, StoreStatus } from '../types/store';
import { getStoreStatus } from '../lib/storeStatus';

const UNKNOWN: StoreStatus = { state: 'unknown' };

/**
 * Returns a Map of store id -> status, filling in as the (lazily loaded)
 * opening_hours parser resolves each one. Stores without an opening_hours
 * tag resolve instantly to 'unknown' without touching the parser at all.
 */
export function useStoreStatuses(stores: LiquorStore[]): Map<string, StoreStatus> {
  const [statuses, setStatuses] = useState<Map<string, StoreStatus>>(new Map());
  const cacheRef = useRef<Map<string, StoreStatus>>(new Map());

  useEffect(() => {
    let cancelled = false;

    const toResolve = stores.filter(
      (s) => Boolean(s.openingHours) && !cacheRef.current.has(s.id)
    );

    if (toResolve.length === 0) return;

    Promise.all(
      toResolve.map(async (store) => {
        const status = await getStoreStatus(store.openingHours);
        cacheRef.current.set(store.id, status);
      })
    ).then(() => {
      if (!cancelled) setStatuses(new Map(cacheRef.current));
    });

    return () => {
      cancelled = true;
    };
  }, [stores]);

  const result = new Map<string, StoreStatus>();
  for (const store of stores) {
    result.set(store.id, cacheRef.current.get(store.id) ?? statuses.get(store.id) ?? UNKNOWN);
  }
  return result;
}
