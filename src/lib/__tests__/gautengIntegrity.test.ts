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
const SNAPSHOT: string[] = JSON.parse(readFileSync(resolve(ART, 'gauteng-id-snapshot-before.json'), 'utf8'));
const NEW_POIS: { id: string; name: string; address?: string }[] = JSON.parse(
  readFileSync(resolve(ART, 'gauteng-new-pois.json'), 'utf8')
).pois;
const KZN_NEW: { id: string }[] = JSON.parse(readFileSync(resolve(ART, 'kzn-new-pois.json'), 'utf8')).pois;
const WC_CLEANUP: { removedFromCatalogIds: string[] } = JSON.parse(
  readFileSync(resolve(ART, 'wc-false-positive-cleanup.json'), 'utf8')
);
const WC_REMOVED = new Set(WC_CLEANUP.removedFromCatalogIds);

describe('Gauteng saturation — zero deletion', () => {
  it('keeps every pre-pass POI id except later explicit WC false-positive removals', () => {
    resetCatalogCache();
    const catalog = loadCatalog();
    const after = new Set(catalog.map((poi) => poi.id));
    expect(SNAPSHOT).toHaveLength(6517);
    const preserved = SNAPSHOT.filter((id) => !WC_REMOVED.has(id));
    const missing = preserved.filter((id) => !after.has(id));
    expect(missing).toEqual([]);
    assertAdditive(
      preserved,
      catalog.map((poi) => poi.id),
      'gauteng-pass'
    );
    expect(NEW_POIS.every((poi) => after.has(poi.id))).toBe(true);
    expect(catalog.length).toBe(SNAPSHOT.length + NEW_POIS.length - WC_REMOVED.size + KZN_NEW.length);
  });
});

describe('Gauteng saturation — match not duplicate', () => {
  it('matches Whisky Emporium Grayston onto existing Liquor City Grayston instead of adding a pin', () => {
    expect(NEW_POIS.some((poi) => /whisky emporium grayston/i.test(poi.name))).toBe(false);
    const catalog = loadCatalog();
    expect(catalog.find((poi) => poi.id === 'gplaces-ChIJHQ_dzzBzlR4RjBoa4EHBM9Y')?.name).toMatch(
      /liquor city grayston/i
    );
  });

  it('does not add Waverley Liquor Store on top of Checkers LiquorShop Waverley at 795 Codonia', () => {
    expect(NEW_POIS.some((poi) => poi.name === 'Waverley Liquor Store')).toBe(false);
    const catalog = loadCatalog();
    expect(catalog.find((poi) => poi.id === 'gplaces-ChIJIa2Q0tXfvx4R1rwDWnrYTaU')?.name).toBe(
      'Checkers LiquorShop Waverley'
    );
  });
});

describe('Gauteng saturation — same brand / different address', () => {
  it('keeps two Red Cap Hyper Liquor branches in Carletonville', () => {
    const catalog = loadCatalog();
    const amethyst = catalog.find((poi) => poi.id === 'gplaces-ChIJzwxYiZLElR4R5xQgfcCnOfk');
    const station = catalog.find((poi) => poi.id === 'gplaces-ChIJU2NgxpnElR4RblkW2DMGGLU');
    expect(amethyst?.name).toBe('Red Cap Hyper Liquor');
    expect(station?.name).toBe('Red Cap Hyper Liquor');
    expect(amethyst?.address).toMatch(/amethyst/i);
    expect(station?.address).toMatch(/station/i);
    expect(amethyst?.id).not.toBe(station?.id);
  });
});

describe('Gauteng saturation — distance is not duplicate proof', () => {
  it('keeps Checkers LiquorShop Pretoria North separate from Shoprite LiquorShop Pretoria North', () => {
    const catalog = loadCatalog();
    const checkers = catalog.find((poi) => poi.id === 'gplaces-ChIJRfOkAFLZvx4RHQjWr2Sg6Sc');
    const shoprite = catalog.find((poi) => poi.id === 'gplaces-ChIJJY3MrxbZvx4RjHS7mm5BzZc');
    expect(checkers?.name).toBe('Checkers LiquorShop Pretoria North');
    expect(shoprite?.name).toBe('Shoprite LiquorShop Pretoria North');
    expect(checkers?.id).not.toBe(shoprite?.id);
  });

  it('keeps TOPS, Pick n Pay Liquor and Shoprite LiquorShop as three Carletonville pins', () => {
    const catalog = loadCatalog();
    const tops = catalog.find((poi) => poi.id === 'gplaces-ChIJX0GQu__ElR4RmwnKagRtWIc');
    const pnp = catalog.find((poi) => poi.id === 'gplaces-ChIJq6N5D-3ElR4R4eQ2xjkDFDA');
    const shoprite = catalog.find((poi) => poi.id === 'gplaces-ChIJger8Qo3ElR4RlR1Kt2As7gE');
    expect(tops?.name).toBe('TOPS at SPAR Carleton');
    expect(pnp?.name).toBe('Pick n Pay Liquor');
    expect(shoprite?.name).toMatch(/shoprite liquorshop/i);
    expect(new Set([tops?.id, pnp?.id, shoprite?.id]).size).toBe(3);
  });

  it('keeps Woolworths WCellar Village View separate from Checkers LiquorShop Village View', () => {
    const catalog = loadCatalog();
    const wcellar = catalog.find((poi) => poi.id === 'gplaces-ChIJ54OsAzgRlR4R8XhSY1vAWqI');
    const checkers = catalog.find((poi) => poi.id === 'gplaces-ChIJVWlT_PURlR4Rrx-m8RS01pA');
    expect(wcellar?.name).toMatch(/wcellar village view/i);
    expect(checkers?.name).toBe('Checkers LiquorShop Village View');
    expect(wcellar?.id).not.toBe(checkers?.id);
  });
});

describe('Gauteng saturation — supermarket vs bottle store', () => {
  it('does not add SPAR / Checkers / Shoprite / Pick n Pay supermarket pins', () => {
    expect(NEW_POIS.every((poi) => !/^(spar|superspar|checkers|shoprite|pick n pay)$/i.test(poi.name))).toBe(
      true
    );
    expect(NEW_POIS.some((poi) => /^pick n pay family/i.test(poi.name))).toBe(false);
    expect(NEW_POIS.some((poi) => /^cambridge food/i.test(poi.name))).toBe(false);
    expect(NEW_POIS.some((poi) => /boxer superstore/i.test(poi.name))).toBe(false);
    expect(NEW_POIS.some((poi) => /^president hyper$/i.test(poi.name))).toBe(false);
  });

  it('does add dedicated liquor banners found in the West Rand gap', () => {
    expect(NEW_POIS.some((poi) => poi.id === 'gplaces-ChIJ10f3M8qVlR4RN1pGX6umg44')).toBe(true);
    expect(NEW_POIS.find((poi) => poi.id === 'gplaces-ChIJ10f3M8qVlR4RN1pGX6umg44')?.name).toBe(
      'Dwarskloof Bottel Stoor'
    );
    expect(NEW_POIS.some((poi) => poi.id === 'gplaces-ChIJB9PY7GS9lR4RX_jmWQXrHHE')).toBe(true);
  });
});

describe('Gauteng saturation — Consumption Off is not enough', () => {
  it('does not promote unverified gazette applications or on-consumption venues', () => {
    expect(NEW_POIS.some((poi) => /drinkify/i.test(poi.name))).toBe(false);
    expect(NEW_POIS.some((poi) => /raborife/i.test(poi.name))).toBe(false);
    expect(NEW_POIS.some((poi) => /mr liquor pub/i.test(poi.name))).toBe(false);
    expect(NEW_POIS.some((poi) => /wine farm|wine estate|winery/i.test(poi.name))).toBe(false);
    expect(NEW_POIS.some((poi) => /dark store/i.test(poi.name))).toBe(false);
  });
});

describe('Gauteng saturation — source failure cannot delete', () => {
  it('provider failure states never allow deletion', () => {
    expect(sourceStateAllowsDeletion('SOURCE_FAILED')).toBe(false);
    expect(sourceStateAllowsDeletion('SOURCE_TIMEOUT')).toBe(false);
    expect(sourceStateAllowsDeletion('SOURCE_ZERO_RESULTS')).toBe(false);
    expect(sourceStateAllowsDeletion('SOURCE_UNAVAILABLE')).toBe(false);
  });

  it('additive insert of an empty Gauteng batch leaves the catalog untouched', () => {
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

  it('google catalog file only grew by the new Gauteng ids, minus explicit WC false-positive removals', () => {
    const googleIds = googleCatalogPois().map((poi) => poi.id);
    const beforeGoogle = SNAPSHOT.filter((id) => id.startsWith('gplaces-') && !WC_REMOVED.has(id));
    expect(beforeGoogle.every((id) => googleIds.includes(id))).toBe(true);
    expect(NEW_POIS.every((poi) => googleIds.includes(poi.id))).toBe(true);
    const removedGoogle = SNAPSHOT.filter((id) => id.startsWith('gplaces-') && WC_REMOVED.has(id));
    expect(googleIds).toHaveLength(beforeGoogle.length + NEW_POIS.length + KZN_NEW.length);
    expect(removedGoogle.every((id) => !googleIds.includes(id))).toBe(true);
    expect((googlePlacesFile as { pois: unknown[] }).pois).toHaveLength(googleIds.length);
  });
});
