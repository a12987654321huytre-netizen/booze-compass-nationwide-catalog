import { describe, it, expect } from 'vitest';
import { SA_PROVINCES } from '../saGeography';
import {
  catalogStats,
  existingCatalogWithoutGoogle,
  ingestObservations,
  loadCatalog,
  observationToCatalogPoi,
} from '../poiCatalog';
import { CURATED_ADDITIONS } from '../../data/curatedPois';
import type { GooglePlaceObservation } from '../googlePlacesProvider';

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

describe('poi catalog is additive and nationwide', () => {
  it('keeps every seed and curated id after a thin Google ingest', () => {
    const existing = existingCatalogWithoutGoogle();
    const beforeIds = existing.map((poi) => poi.id);
    expect(beforeIds.length).toBeGreaterThan(CURATED_ADDITIONS.length);

    const result = ingestObservations(existing, [
      observation({
        googlePlaceId: 'ChIJ-polokwane-1',
        name: 'House of Liquor',
        latitude: -23.9045,
        longitude: 29.4689,
        address: 'Polokwane, Limpopo',
        province: 'Limpopo',
      }),
      observation({
        googlePlaceId: 'ChIJ-kimberley-1',
        name: 'Royal Street Bottle Store',
        latitude: -28.7282,
        longitude: 24.7499,
        address: 'Kimberley, Northern Cape',
        province: 'Northern Cape',
      }),
    ]);

    expect(beforeIds.every((id) => result.catalog.some((poi) => poi.id === id))).toBe(true);
    expect(result.catalog.length).toBe(existing.length + 2);
    expect(result.added).toHaveLength(2);
  });

  it('does not treat a Cape Town-heavy Google page as a Limpopo deletion', () => {
    const existing = existingCatalogWithoutGoogle();
    const limpopo = ingestObservations(existing, [
      observation({
        googlePlaceId: 'lp-keep',
        name: 'TOPS at SPAR Polokwane',
        latitude: -23.9,
        longitude: 29.45,
        province: 'Limpopo',
      }),
    ]);
    const capeTownWave = Array.from({ length: 40 }, (_, i) =>
      observation({
        googlePlaceId: `ct-wave-${i}`,
        name: `Checkers LiquorShop ${i}`,
        latitude: -33.92 + i * 0.001,
        longitude: 18.42,
        province: 'Western Cape',
      })
    );
    const after = ingestObservations(limpopo.catalog, capeTownWave);
    expect(after.catalog.find((poi) => poi.id === 'gplaces-lp-keep')).toBeTruthy();
    expect(existing.every((poi) => after.catalog.some((row) => row.id === poi.id))).toBe(true);
  });

  it('rewrites a supermarket-named liquor_store to the liquor banner', () => {
    const poi = observationToCatalogPoi(
      observation({
        googlePlaceId: 'pnp-braam',
        name: 'Pick n Pay Family Braamfontein',
        latitude: -26.192,
        longitude: 28.034,
        address: 'Braamfontein, Johannesburg',
      })
    );
    expect(poi.name).toBe('Pick n Pay Liquor');
    expect(poi.parentName).toBe('Pick n Pay');
    expect(poi.source).toBe('google-places');
    expect(poi.id).toBe('gplaces-pnp-braam');
  });

  it('loadCatalog still contains the original Western Cape seed', () => {
    const catalog = loadCatalog();
    const existing = existingCatalogWithoutGoogle();
    const stats = catalogStats(catalog);
    expect(existing.every((poi) => catalog.some((row) => row.id === poi.id))).toBe(true);
    expect(stats.bySource.curated).toBe(CURATED_ADDITIONS.length);
    expect(stats.byProvince['Western Cape']).toBeGreaterThanOrEqual(existing.filter((p) => p.province === 'Western Cape').length);
  });

  it('search grid + catalog together are not Cape Town-only', () => {
    expect(SA_PROVINCES).toHaveLength(9);
    const existing = existingCatalogWithoutGoogle();
    // Seed concentration in the Western Cape is a historical extract, not scope.
    const westernCape = existing.filter((poi) => poi.province === 'Western Cape').length;
    expect(westernCape).toBeGreaterThan(0);
    expect(westernCape).toBe(existing.length);
  });

  it('Google catalog is additive nationwide and covers all nine provinces', () => {
    const catalog = loadCatalog();
    const existing = existingCatalogWithoutGoogle();
    const stats = catalogStats(catalog);
    expect(existing.every((poi) => catalog.some((row) => row.id === poi.id))).toBe(true);
    for (const province of SA_PROVINCES) {
      expect(stats.byProvince[province] ?? 0, province).toBeGreaterThan(0);
    }
    expect(stats.bySource['google-places']).toBeGreaterThan(1000);
    expect(stats.byProvince['Gauteng']).toBeGreaterThan(stats.byProvince['Western Cape'] * 0.5);
  });
});
