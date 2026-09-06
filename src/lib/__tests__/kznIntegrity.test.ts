import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  loadCatalog,
  googleCatalogPois,
  resetCatalogCache,
} from '../poiCatalog';
import { applyAdditiveInserts, assertAdditive, sourceStateAllowsDeletion } from '../poiIntegrity';
import googlePlacesFile from '../../data/googlePlacesPois.json';

const ART = resolve(__dirname, '../../../artifacts');
const SNAPSHOT: string[] = JSON.parse(readFileSync(resolve(ART, 'kzn-id-snapshot-before.json'), 'utf8'));
const NEW_POIS: { id: string; name: string; address?: string }[] = JSON.parse(
  readFileSync(resolve(ART, 'kzn-new-pois.json'), 'utf8')
).pois;
const REJECTED: { name?: string }[] = JSON.parse(readFileSync(resolve(ART, 'kzn-rejected.json'), 'utf8'));

describe('KZN saturation — zero deletion', () => {
  it('keeps every pre-pass POI id and only grows by the new KZN ids', () => {
    resetCatalogCache();
    const catalog = loadCatalog();
    const after = new Set(catalog.map((poi) => poi.id));
    expect(SNAPSHOT).toHaveLength(6739);
    const missing = SNAPSHOT.filter((id) => !after.has(id));
    expect(missing).toEqual([]);
    assertAdditive(
      SNAPSHOT,
      catalog.map((poi) => poi.id),
      'kzn-pass'
    );
    expect(NEW_POIS.every((poi) => after.has(poi.id))).toBe(true);
    expect(catalog.length).toBe(SNAPSHOT.length + NEW_POIS.length);
    expect(NEW_POIS).toHaveLength(315);
  });
});

describe('KZN saturation — match not duplicate', () => {
  it('matches Liberty Liquors Denis Hurley onto the existing pin instead of adding a second one', () => {
    const catalog = loadCatalog();
    const liberty = catalog.filter(
      (poi) => poi.id === 'gplaces-ChIJzbhAFcap9x4RBK4UiLWGX6s' || /liberty liquors/i.test(poi.name)
    );
    const denis = catalog.find((poi) => poi.id === 'gplaces-ChIJzbhAFcap9x4RBK4UiLWGX6s');
    expect(denis?.name).toMatch(/liberty liquors/i);
    expect(denis?.address).toMatch(/denis hurley/i);
    expect(NEW_POIS.filter((poi) => poi.id === 'gplaces-ChIJzbhAFcap9x4RBK4UiLWGX6s')).toHaveLength(0);
    expect(liberty.filter((poi) => /denis hurley/i.test(poi.address || '')).length).toBe(1);
  });
});

describe('KZN saturation — same brand / different address', () => {
  it('keeps two Liberty Liquors branches in Durban as separate pins', () => {
    const catalog = loadCatalog();
    const denis = catalog.find((poi) => poi.id === 'gplaces-ChIJzbhAFcap9x4RBK4UiLWGX6s');
    const sandile = catalog.find((poi) => poi.id === 'gplaces-ChIJX7wCLH0H9x4R2T_KU1loVEU');
    expect(denis?.name).toMatch(/liberty liquors/i);
    expect(sandile?.name).toMatch(/liberty liquors/i);
    expect(denis?.address).toMatch(/denis hurley/i);
    expect(sandile?.address).toMatch(/sandile thusi/i);
    expect(denis?.id).not.toBe(sandile?.id);
  });
});

describe('KZN saturation — distance is not duplicate proof', () => {
  it('keeps PicardiRebel Davenport separate from Checkers LiquorShop Davenport', () => {
    const catalog = loadCatalog();
    const picardi = catalog.find((poi) => poi.id === 'gplaces-ChIJ51Sa_Oyp9x4RKCAkvUNF9MU');
    const checkers = catalog.find((poi) => poi.id === 'gplaces-ChIJU3SfS6-p9x4RjqMf86E5Sw0');
    expect(picardi?.name).toMatch(/picardi/i);
    expect(checkers?.name).toMatch(/checkers liquorshop davenport/i);
    expect(picardi?.id).not.toBe(checkers?.id);
  });

  it('keeps Checkers LiquorShop Hillcrest Corner, The Colony Checkers, and WCellar Hillcrest as three pins', () => {
    const catalog = loadCatalog();
    const corner = catalog.find((poi) => poi.id === 'gplaces-ChIJhXj1pgD79h4RdqwcFV1QBJo');
    const colony = catalog.find((poi) => poi.id === 'gplaces-ChIJkTuILmT79h4RsWOYZ_BtHgc');
    const wcellar = catalog.find((poi) => poi.id === 'gplaces-ChIJxfEqxKr79h4Ralq8C5XsL_0');
    expect(corner?.name).toMatch(/checkers liquorshop hillcrest/i);
    expect(colony?.name).toMatch(/the colony/i);
    expect(wcellar?.name).toMatch(/wcellar hillcrest/i);
    expect(new Set([corner?.id, colony?.id, wcellar?.id]).size).toBe(3);
  });
});

describe('KZN saturation — supermarket vs bottle store', () => {
  it('does not add SPAR / Checkers / Shoprite / Pick n Pay supermarket pins', () => {
    expect(NEW_POIS.every((poi) => !/^(spar|superspar|checkers|shoprite|pick n pay)$/i.test(poi.name))).toBe(
      true
    );
    expect(NEW_POIS.some((poi) => /^cambridge food/i.test(poi.name))).toBe(false);
    expect(NEW_POIS.some((poi) => /boxer superstore/i.test(poi.name))).toBe(false);
    expect(NEW_POIS.some((poi) => /kwa mashu power spar/i.test(poi.name))).toBe(false);
  });

  it('does add dedicated liquor banners found in the KZN gap', () => {
    expect(NEW_POIS.some((poi) => poi.id === 'gplaces-ChIJKwVU_wj79h4R-XwnWaRJ5l4')).toBe(true);
    expect(NEW_POIS.find((poi) => poi.id === 'gplaces-ChIJKwVU_wj79h4R-XwnWaRJ5l4')?.name).toBe(
      'TOPS at SPAR 1000 Hills'
    );
    expect(NEW_POIS.some((poi) => poi.id === 'gplaces-ChIJe0OsqI_x9h4RwOqoDahUBDo')).toBe(true);
    expect(NEW_POIS.some((poi) => poi.id === 'gplaces-ChIJxfEqxKr79h4Ralq8C5XsL_0')).toBe(true);
  });
});

describe('KZN saturation — Consumption Off is not enough', () => {
  it('does not promote wineries, taverns, ATMs or grocery-only banners', () => {
    expect(NEW_POIS.some((poi) => /audacia wines/i.test(poi.name))).toBe(false);
    expect(NEW_POIS.some((poi) => /eating house/i.test(poi.name))).toBe(false);
    expect(NEW_POIS.some((poi) => /tavern|shebeen|nightclub/i.test(poi.name))).toBe(false);
    expect(NEW_POIS.some((poi) => /wine farm|wine estate|winery/i.test(poi.name))).toBe(false);
    expect(NEW_POIS.some((poi) => /cambridge food/i.test(poi.name))).toBe(false);
    expect(REJECTED.some((row) => /audacia wines/i.test(row.name || ''))).toBe(true);
    expect(REJECTED.some((row) => /cambridge food/i.test(row.name || ''))).toBe(true);
  });
});

describe('KZN saturation — source failure cannot delete', () => {
  it('provider failure states never allow deletion', () => {
    expect(sourceStateAllowsDeletion('SOURCE_FAILED')).toBe(false);
    expect(sourceStateAllowsDeletion('SOURCE_TIMEOUT')).toBe(false);
    expect(sourceStateAllowsDeletion('SOURCE_ZERO_RESULTS')).toBe(false);
    expect(sourceStateAllowsDeletion('SOURCE_UNAVAILABLE')).toBe(false);
  });

  it('additive insert of an empty KZN batch leaves the catalog untouched', () => {
    const existing = loadCatalog().map((poi) => ({
      id: poi.id,
      name: poi.name,
      latitude: poi.latitude,
      longitude: poi.longitude,
    }));
    const result = applyAdditiveInserts(existing, []);
    expect(result.catalog.map((poi) => poi.id)).toEqual(existing.map((poi) => poi.id));
    expect(result.added).toHaveLength(0);
  });

  it('google catalog file only grew by the new KZN ids', () => {
    const googleIds = googleCatalogPois().map((poi) => poi.id);
    const beforeGoogle = SNAPSHOT.filter((id) => id.startsWith('gplaces-'));
    expect(beforeGoogle.every((id) => googleIds.includes(id))).toBe(true);
    expect(NEW_POIS.every((poi) => googleIds.includes(poi.id))).toBe(true);
    expect(googleIds).toHaveLength(beforeGoogle.length + NEW_POIS.length);
    expect((googlePlacesFile as { pois: unknown[] }).pois).toHaveLength(googleIds.length);
  });
});
