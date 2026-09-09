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
const SNAPSHOT: string[] = JSON.parse(readFileSync(resolve(ART, 'sa5-id-snapshot-before.json'), 'utf8'));
const NEW_POIS: { id: string; name: string; address?: string; province?: string }[] = JSON.parse(
  readFileSync(resolve(ART, 'sa5-new-pois.json'), 'utf8')
).pois;
const REJECTED: { name?: string }[] = JSON.parse(readFileSync(resolve(ART, 'sa5-rejected.json'), 'utf8'));

describe('Remaining-provinces saturation — zero deletion', () => {
  it('keeps every pre-pass POI id and only grows by the new FS/LP/MP/NC/NW ids', () => {
    resetCatalogCache();
    const catalog = loadCatalog();
    const after = new Set(catalog.map((poi) => poi.id));
    expect(SNAPSHOT).toHaveLength(7054);
    const missing = SNAPSHOT.filter((id) => !after.has(id));
    expect(missing).toEqual([]);
    assertAdditive(
      SNAPSHOT,
      catalog.map((poi) => poi.id),
      'sa5-pass'
    );
    expect(NEW_POIS.every((poi) => after.has(poi.id))).toBe(true);
    expect(catalog.length).toBe(SNAPSHOT.length + NEW_POIS.length);
    expect(NEW_POIS).toHaveLength(562);
  });
});

describe('Remaining-provinces saturation — match not duplicate', () => {
  it('matches Liquor City Witbank Crescent onto existing Whisky Emporium Witbank Crescent', () => {
    expect(NEW_POIS.some((poi) => /liquor city witbank crescent/i.test(poi.name))).toBe(false);
    const catalog = loadCatalog();
    expect(catalog.find((poi) => poi.id === 'gplaces-ChIJ6w0cvmvz6h4RkpHOTOdHE5U')?.name).toMatch(
      /whisky emporium witbank crescent/i
    );
  });

  it('does not add a second Shoprite Liquor Tonga next to Shoprite LiquorShop Tonga', () => {
    expect(NEW_POIS.some((poi) => poi.name === 'Shoprite Liquor Tonga')).toBe(false);
    expect(NEW_POIS.some((poi) => poi.id === 'gplaces-ChIJa3igOkYt5h4RvlXpdyWHrUk')).toBe(true);
    expect(NEW_POIS.find((poi) => poi.id === 'gplaces-ChIJa3igOkYt5h4RvlXpdyWHrUk')?.name).toMatch(
      /shoprite liquorshop tonga/i
    );
  });
});

describe('Remaining-provinces saturation — same brand / different address', () => {
  it('keeps two Ultra Liquors branches in Parys as separate pins', () => {
    const catalog = loadCatalog();
    const bree = catalog.find((poi) => poi.id === 'gplaces-ChIJ10-8Lrc9lB4RUetlTnmA40Q');
    const tumahole = catalog.find((poi) => poi.id === 'gplaces-ChIJPckiBg0_lB4Ro6QD_OgBybY');
    expect(bree?.name).toMatch(/ultra liquor/i);
    expect(tumahole?.name).toMatch(/ultra liquor/i);
    expect(bree?.address).toMatch(/bree/i);
    expect(tumahole?.address).toMatch(/tumahole|arthur fisher/i);
    expect(bree?.id).not.toBe(tumahole?.id);
  });
});

describe('Remaining-provinces saturation — distance is not duplicate proof', () => {
  it('keeps TOPS at SPAR Reitz separate from Shoprite LiquorShop Reitz at 39 Uniefees', () => {
    const catalog = loadCatalog();
    const tops = catalog.find((poi) => poi.id === 'gplaces-ChIJ0Sste_3Ykh4RCleTG53FKlE');
    const shoprite = catalog.find((poi) => poi.id === 'gplaces-ChIJNXwdp8rZkh4RkkTV3nqiCs0');
    expect(tops?.name).toMatch(/tops at spar reitz/i);
    expect(shoprite?.name).toMatch(/shoprite liquorshop reitz/i);
    expect(tops?.id).not.toBe(shoprite?.id);
  });

  it('keeps Shoprite LiquorShop Lephalale Mall separate from Checkers LiquorShop Lephalale Mall', () => {
    const catalog = loadCatalog();
    const shoprite = catalog.find((poi) => poi.id === 'gplaces-ChIJEw56FZSnuR4RIII-_dqcosI');
    const checkers = catalog.find((poi) => poi.id === 'gplaces-ChIJven4LaKouR4REQENo4UxNf4');
    expect(shoprite?.name).toMatch(/shoprite liquorshop lephalale/i);
    expect(checkers?.name).toMatch(/checkers liquorshop lephalale/i);
    expect(shoprite?.id).not.toBe(checkers?.id);
  });

  it('keeps Ultra Liquor Parys separate from existing Liquor City Parys on Bree Street', () => {
    const catalog = loadCatalog();
    const ultra = catalog.find((poi) => poi.id === 'gplaces-ChIJ10-8Lrc9lB4RUetlTnmA40Q');
    const liquorCity = catalog.find((poi) => poi.id === 'gplaces-ChIJ502zW9w9lB4R7x-T5A1j9Vg');
    expect(ultra?.name).toMatch(/ultra liquor parys/i);
    expect(liquorCity?.name).toMatch(/liquor city parys/i);
    expect(NEW_POIS.some((poi) => poi.id === liquorCity?.id)).toBe(false);
    expect(ultra?.id).not.toBe(liquorCity?.id);
  });

  it('keeps Tsie\'s Bottle-Store separate from existing Walaza Bottle Store on Magano Street', () => {
    const catalog = loadCatalog();
    const tsies = catalog.find((poi) => poi.id === 'gplaces-ChIJ87gDZH_Pjx4R6Cde8mG7Bho');
    const walaza = catalog.find((poi) => poi.id === 'gplaces-ChIJ36UdZH_Pjx4RzcuNw1HzVkk');
    expect(tsies?.name).toMatch(/tsie's bottle/i);
    expect(walaza?.name).toMatch(/walaza/i);
    expect(tsies?.id).not.toBe(walaza?.id);
  });
});

describe('Remaining-provinces saturation — supermarket vs bottle store', () => {
  it('does not add SPAR / Checkers / Shoprite / Pick n Pay supermarket pins', () => {
    expect(NEW_POIS.every((poi) => !/^(spar|superspar|checkers|shoprite|pick n pay)$/i.test(poi.name))).toBe(
      true
    );
    expect(NEW_POIS.some((poi) => /boxer superstore/i.test(poi.name))).toBe(false);
  });

  it('does add dedicated liquor banners found in the five-province gap', () => {
    expect(NEW_POIS.some((poi) => poi.id === 'gplaces-ChIJ4RO8JEkz5h4ROxMg3DARMmw')).toBe(true);
    expect(NEW_POIS.find((poi) => poi.id === 'gplaces-ChIJ4RO8JEkz5h4ROxMg3DARMmw')?.name).toBe(
      'TOPS at SPAR Naas'
    );
    expect(NEW_POIS.some((poi) => poi.id === 'gplaces-ChIJJ9W03zS6gR4RpBGZrzWIycg')).toBe(true);
    expect(NEW_POIS.find((poi) => poi.id === 'gplaces-ChIJJ9W03zS6gR4RpBGZrzWIycg')?.province).toBe(
      'Northern Cape'
    );
  });
});

describe('Remaining-provinces saturation — Consumption Off is not enough', () => {
  it('does not promote distributors, restaurants, mixed butcher-delis or wine farms', () => {
    expect(NEW_POIS.some((poi) => /da beer house/i.test(poi.name))).toBe(false);
    expect(NEW_POIS.some((poi) => /mkhombo supermarket/i.test(poi.name))).toBe(false);
    expect(NEW_POIS.some((poi) => /sister boss/i.test(poi.name))).toBe(false);
    expect(NEW_POIS.some((poi) => /distributor|distribution/i.test(poi.name))).toBe(false);
    expect(NEW_POIS.some((poi) => /wholesaler|groothandel/i.test(poi.name) && !/overland/i.test(poi.name))).toBe(
      false
    );
    expect(NEW_POIS.some((poi) => /wine farm|wine estate|winery/i.test(poi.name))).toBe(false);
    expect(NEW_POIS.some((poi) => /tavern|shebeen|nightclub/i.test(poi.name))).toBe(false);
    expect(REJECTED.some((row) => /da beer house/i.test(row.name || ''))).toBe(true);
  });

  it('keeps Overland Ventersdorp because Overland is a walk-in liquor chain', () => {
    expect(NEW_POIS.some((poi) => poi.id === 'gplaces-ChIJMx7jMp4Vlh4RZ5VcQl4SlTA')).toBe(true);
    expect(NEW_POIS.find((poi) => poi.id === 'gplaces-ChIJMx7jMp4Vlh4RZ5VcQl4SlTA')?.name).toMatch(
      /overland/i
    );
  });
});

describe('Remaining-provinces saturation — province assignment', () => {
  it('assigns Liquor City Sentrum Vrede to Free State, not Mpumalanga', () => {
    const vrede = NEW_POIS.find((poi) => poi.id === 'gplaces-ChIJC9tAqUfl7B4RbPnp11ZxMuo');
    expect(vrede?.name).toMatch(/liquor city sentrum vrede/i);
    expect(vrede?.province).toBe('Free State');
  });
});

describe('Remaining-provinces saturation — source failure cannot delete', () => {
  it('provider failure states never allow deletion', () => {
    expect(sourceStateAllowsDeletion('SOURCE_FAILED')).toBe(false);
    expect(sourceStateAllowsDeletion('SOURCE_TIMEOUT')).toBe(false);
    expect(sourceStateAllowsDeletion('SOURCE_ZERO_RESULTS')).toBe(false);
    expect(sourceStateAllowsDeletion('SOURCE_UNAVAILABLE')).toBe(false);
  });

  it('additive insert of an empty remaining-provinces batch leaves the catalog untouched', () => {
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

  it('google catalog file only grew by the new remaining-province ids', () => {
    const googleIds = googleCatalogPois().map((poi) => poi.id);
    const beforeGoogle = SNAPSHOT.filter((id) => id.startsWith('gplaces-'));
    expect(beforeGoogle.every((id) => googleIds.includes(id))).toBe(true);
    expect(NEW_POIS.every((poi) => googleIds.includes(poi.id))).toBe(true);
    expect(googleIds).toHaveLength(beforeGoogle.length + NEW_POIS.length);
    expect((googlePlacesFile as { pois: unknown[] }).pois).toHaveLength(googleIds.length);
  });
});
