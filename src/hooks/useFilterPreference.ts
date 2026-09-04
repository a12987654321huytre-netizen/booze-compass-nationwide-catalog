import { useCallback, useState } from 'react';
import { CONFIG } from '../lib/config';

export type FilterPreference = 'nearest' | 'nearest-open';

function readInitial(): FilterPreference {
  try {
    const stored = localStorage.getItem(CONFIG.filterPrefStorageKey);
    return stored === 'nearest-open' ? 'nearest-open' : 'nearest';
  } catch {
    return 'nearest';
  }
}

export function useFilterPreference() {
  const [preference, setPreferenceState] = useState<FilterPreference>(readInitial);

  const setPreference = useCallback((pref: FilterPreference) => {
    setPreferenceState(pref);
    try {
      localStorage.setItem(CONFIG.filterPrefStorageKey, pref);
    } catch {
      // ignore
    }
  }, []);

  return { preference, setPreference };
}
