import { describe, it, expect } from 'vitest';
import {
  applyAdditiveInserts,
  assertAdditive,
  deletePoiById,
  IntegrityError,
  mergeDuplicatePair,
  sourceStateAllowsDeletion,
  type CatalogRecord,
} from '../poiIntegrity';
import { ingestObservations, type CatalogPoi } from '../poiCatalog';
import type { GooglePlaceObservation } from '../googlePlacesProvider';
import { SA_PROVINCES, SA_SEARCH_GRID, provincesCoveredByGrid } from '../saGeography';
import { matchObservation } from '../poiMatch';

function poi(partial: Partial<CatalogPoi> & Pick<CatalogPoi, 'id' | 'name'>): CatalogPoi {
  return {
    latitude: -33.92,
    longitude: 18.42,
    locationType: 'standalone',
    source: 'osm-seed',
    ...partial,
  };
}

function observation(
  partial: Partial<GooglePlaceObservation> & Pick<GooglePlaceObservation, 'googlePlaceId' | 'name'>
): GooglePlaceObservation {
  return {
    latitude: -26.2,
    longitude: 28.04,
    types: ['liquor_store', 'store', 'point_of_interest'],
    queryId: 'test',
    ...partial,
  };
}

describe('6A data integrity — provider responses never replace the catalog', () => {
  it('1-3. 10 existing POIs survive a provider that returns only 4', () => {
    const existing = Array.from({ length: 10 }, (_, i) =>
      poi({ id: `exist-${i}`, name: `Store ${i}`, latitude: -33.9 - i * 0.01, longitude: 18.4 })
    );
    const incoming = existing.slice(0, 4).map((row, i) =>
      observation({
        googlePlaceId: `g-${i}`,
        name: row.name,
        latitude: row.latitude,
        longitude: row.longitude,
      })
    );
    const result = ingestObservations(existing, incoming);
    expect(result.catalog).toHaveLength(10);
    expect(existing.every((row) => result.catalog.some((p) => p.id === row.id))).toBe(true);
    expect(result.added).toHaveLength(0);
    expect(result.confirmedMatches).toBeGreaterThanOrEqual(4);
  });

  it('4-5. a second provider ingest still keeps every original id', () => {
    const existing = Array.from({ length: 10 }, (_, i) => poi({ id: `e${i}`, name: `N${i}` }));
    const first = ingestObservations(existing, [
      observation({ googlePlaceId: 'new-a', name: 'Ultra Liquors Pretoria', latitude: -25.75, longitude: 28.22 }),
    ]);
    const second = ingestObservations(first.catalog, [
      observation({ googlePlaceId: 'new-b', name: 'TOPS at SPAR Polokwane', latitude: -23.9, longitude: 29.45 }),
    ]);
    expect(second.catalog.map((p) => p.id)).toEqual(
      expect.arrayContaining(existing.map((p) => p.id))
    );
    expect(second.catalog).toHaveLength(12);
  });

  it('6-8. merging two genuine duplicates leaves unrelated rows', () => {
    const catalog = [
      poi({ id: 'keep', name: 'Village Liquors', latitude: -33.92364, longitude: 18.8552 }),
      poi({ id: 'drop', name: 'Village Liquors', latitude: -33.92365, longitude: 18.85521 }),
      poi({ id: 'other', name: 'Liquor City', latitude: -33.93, longitude: 18.86 }),
    ];
    const merged = mergeDuplicatePair(catalog, 'keep', 'drop', (keep, drop) => ({
      ...keep,
      address: keep.address || drop.address,
    }));
    expect(merged.map((p) => p.id).sort()).toEqual(['keep', 'other']);
    expect(merged.find((p) => p.id === 'other')?.name).toBe('Liquor City');
  });

  it('9-10. delete by explicit id removes only that POI', () => {
    const catalog = [
      poi({ id: 'a', name: 'A' }),
      poi({ id: 'b', name: 'B' }),
      poi({ id: 'c', name: 'C' }),
    ];
    const next = deletePoiById(catalog, 'b');
    expect(next.map((p) => p.id)).toEqual(['a', 'c']);
  });

  it('11-13. same brand in three cities: deleting one leaves the others', () => {
    const catalog = [
      poi({ id: 'vl-ct', name: 'Village Liquors', latitude: -33.92, longitude: 18.42 }),
      poi({ id: 'vl-stb', name: 'Village Liquors', latitude: -33.93, longitude: 18.86 }),
      poi({ id: 'vl-jhb', name: 'Village Liquors', latitude: -26.2, longitude: 28.05 }),
    ];
    const next = deletePoiById(catalog, 'vl-ct');
    expect(next).toHaveLength(2);
    expect(next.map((p) => p.id).sort()).toEqual(['vl-jhb', 'vl-stb']);
  });

  it('14-15. every provider failure state leaves the catalog intact', () => {
    const existing = Array.from({ length: 8 }, (_, i) => poi({ id: `p${i}`, name: `P${i}` }));
    const emptyIngest = ingestObservations(existing, []);
    expect(emptyIngest.catalog).toHaveLength(8);
    expect(sourceStateAllowsDeletion('SOURCE_FAILED')).toBe(false);
    expect(sourceStateAllowsDeletion('SOURCE_TIMEOUT')).toBe(false);
    expect(sourceStateAllowsDeletion('SOURCE_UNAVAILABLE')).toBe(false);
    expect(sourceStateAllowsDeletion('SOURCE_ZERO_RESULTS')).toBe(false);
    expect(sourceStateAllowsDeletion('SOURCE_PARTIAL_RESULTS')).toBe(false);
    expect(sourceStateAllowsDeletion('SOURCE_SUCCESS')).toBe(false);
  });

  it('16-17. recovery after a failed ingest still does not delete', () => {
    const existing = Array.from({ length: 6 }, (_, i) => poi({ id: `r${i}`, name: `R${i}` }));
    const afterFail = ingestObservations(existing, []);
    const afterRecover = ingestObservations(afterFail.catalog, [
      observation({
        googlePlaceId: 'recover-1',
        name: 'House of Liquor',
        latitude: -23.886,
        longitude: 29.497,
      }),
    ]);
    expect(afterRecover.catalog.map((p) => p.id)).toEqual(
      expect.arrayContaining(existing.map((p) => p.id))
    );
    expect(afterRecover.added).toHaveLength(1);
  });

  it('18. discovery grid covers all nine provinces', () => {
    expect(provincesCoveredByGrid()).toEqual([...SA_PROVINCES]);
    for (const province of SA_PROVINCES) {
      const points = SA_SEARCH_GRID.filter((p) => p.province === province);
      expect(points.length, province).toBeGreaterThanOrEqual(8);
    }
  });

  it('19. many Cape Town observations do not remove a Limpopo record', () => {
    const existing = [
      poi({ id: 'lp-1', name: 'House of Liquor', latitude: -23.886, longitude: 29.497 }),
      poi({ id: 'ct-1', name: 'Village Liquors', latitude: -33.92, longitude: 18.42 }),
    ];
    const capeTownOnly = Array.from({ length: 20 }, (_, i) =>
      observation({
        googlePlaceId: `ct-obs-${i}`,
        name: `Checkers LiquorShop ${i}`,
        latitude: -33.92 + i * 0.002,
        longitude: 18.42 + i * 0.002,
      })
    );
    const result = ingestObservations(existing, capeTownOnly);
    expect(result.catalog.find((p) => p.id === 'lp-1')).toBeTruthy();
    expect(result.catalog.find((p) => p.id === 'ct-1')).toBeTruthy();
  });

  it('20. nationwide ingest is additive and not Cape Town-limited', () => {
    const existing = [poi({ id: 'seed-ct', name: 'Picardi Rebel', latitude: -33.93, longitude: 18.86 })];
    const nationwide = [
      observation({ googlePlaceId: 'g-pe', name: 'Ultra Liquors Gqeberha', latitude: -33.96, longitude: 25.6 }),
      observation({ googlePlaceId: 'g-dbn', name: 'TOPS at SPAR Durban', latitude: -29.86, longitude: 31.02 }),
      observation({ googlePlaceId: 'g-jhb', name: 'Norman Goodfellows Sandton', latitude: -26.11, longitude: 28.05 }),
      observation({ googlePlaceId: 'g-pol', name: 'House of Liquor', latitude: -23.89, longitude: 29.5 }),
      observation({ googlePlaceId: 'g-kim', name: 'Royal Street Bottle Store', latitude: -28.73, longitude: 24.74 }),
      observation({ googlePlaceId: 'g-blm', name: 'Checkers LiquorShop Bloemfontein', latitude: -29.09, longitude: 26.16 }),
      observation({ googlePlaceId: 'g-mb', name: 'Pick n Pay Liquor Mbombela', latitude: -25.47, longitude: 30.98 }),
      observation({ googlePlaceId: 'g-mah', name: 'TOPS at SPAR Mahikeng', latitude: -25.86, longitude: 25.64 }),
    ];
    const result = ingestObservations(existing, nationwide);
    expect(result.catalog.find((p) => p.id === 'seed-ct')).toBeTruthy();
    expect(result.added.length).toBe(8);
    expect(result.catalog.length).toBe(9);
  });
});

describe('assertAdditive', () => {
  it('throws if a caller tries to replace the catalog', () => {
    expect(() => assertAdditive(['a', 'b', 'c'], ['b'], 'test')).toThrow(IntegrityError);
  });

  it('allows growth', () => {
    expect(() => assertAdditive(['a'], ['a', 'b'], 'test')).not.toThrow();
  });
});

describe('applyAdditiveInserts', () => {
  it('does not duplicate existing ids', () => {
    const existing: CatalogRecord[] = [{ id: 'a', name: 'A', latitude: 0, longitude: 0 }];
    const result = applyAdditiveInserts(existing, [
      { id: 'a', name: 'A-dup', latitude: 1, longitude: 1 },
      { id: 'b', name: 'B', latitude: 2, longitude: 2 },
    ]);
    expect(result.catalog).toHaveLength(2);
    expect(result.catalog[0].name).toBe('A');
    expect(result.added).toHaveLength(1);
  });
});

describe('same-name different towns stay separate', () => {
  it('does not treat Village Liquors JHB as the Stellenbosch store', () => {
    const existing = [
      poi({ id: 'vl-stb', name: 'Village Liquors', latitude: -33.92364, longitude: 18.8552 }),
    ];
    const result = matchObservation(
      {
        id: 'obs',
        name: 'Village Liquors',
        latitude: -26.2041,
        longitude: 28.0473,
      },
      existing
    );
    expect(result.class).toBe('NEW_POI');
  });
});
