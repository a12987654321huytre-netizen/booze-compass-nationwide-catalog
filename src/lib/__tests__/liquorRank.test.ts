import { describe, it, expect } from 'vitest';
import { dedupeStores } from '../liquorRank';
import type { LiquorStore } from '../../types/store';

function store(partial: Partial<LiquorStore> & Pick<LiquorStore, 'id' | 'name'>): LiquorStore {
  return {
    latitude: -33.93575,
    longitude: 18.86016,
    source: 'osm',
    locationType: 'standalone',
    matchConfidence: 80,
    ...partial,
  };
}

describe('dedupeStores', () => {
  it('collapses Woolworths + Woolworths Cellar at the same door into Cellar', () => {
    const result = dedupeStores([
      store({
        id: 'a',
        name: 'Woolworths',
        locationType: 'attached-counter',
        parentName: 'Woolworths',
        matchConfidence: 75,
        source: 'osm-seed',
      }),
      store({
        id: 'b',
        name: 'Woolworths Cellar',
        locationType: 'attached-counter',
        parentName: 'Woolworths',
        matchConfidence: 95,
        source: 'curated',
        latitude: -33.93576,
        longitude: 18.86017,
      }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Woolworths Cellar');
    expect(result[0].source).toBe('curated');
  });

  it('does not merge two different stores 200m apart', () => {
    const result = dedupeStores([
      store({ id: 'a', name: 'Pick n Pay Liquor', latitude: -33.9324, longitude: 18.86003 }),
      store({ id: 'b', name: 'Liquor City', latitude: -33.93395, longitude: 18.85917 }),
    ]);
    expect(result).toHaveLength(2);
  });

  it('prefers a specific liquor name over generic Liquor store', () => {
    const result = dedupeStores([
      store({ id: 'a', name: 'Liquor store', matchConfidence: 100, source: 'osm' }),
      store({
        id: 'b',
        name: 'Village Liquors',
        matchConfidence: 95,
        source: 'osm',
        latitude: -33.93574,
        longitude: 18.86015,
      }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Village Liquors');
  });
});
