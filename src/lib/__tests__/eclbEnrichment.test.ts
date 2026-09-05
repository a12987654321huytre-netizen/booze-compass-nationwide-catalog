import { describe, it, expect } from 'vitest';
import { discoverLocal } from '../discovery';
import {
  existingCatalogWithoutGoogle,
  googleCatalogPois,
  loadCatalog,
} from '../poiCatalog';
import {
  isSafePublicStoreName,
  looksLikePersonName,
  publicEclbDisplayName,
} from '../eclb';
import eclbNew from '../../data/eclbNewPois.json';
import eclbEnrichment from '../../data/eclbEnrichment.json';
import wclaNew from '../../data/wclaNewPois.json';
import type { EclbEnrichmentFile, EclbNewPoiFile } from '../eclb';
import type { WclaNewPoiFile } from '../wcla';

const NEW_POIS = eclbNew as EclbNewPoiFile;
const ENRICHMENT = eclbEnrichment as EclbEnrichmentFile;
const WCLA_NEW = wclaNew as WclaNewPoiFile;

describe('ECLB public naming', () => {
  it('never treats a personal licence-holder as a map name', () => {
    expect(looksLikePersonName('Anton Viljoen')).toBe(true);
    expect(looksLikePersonName('Frederick Johannes Stewart')).toBe(true);
    expect(looksLikePersonName('Bay Liquor')).toBe(false);
    expect(looksLikePersonName('Ultra Liquors Oxford')).toBe(false);
    expect(isSafePublicStoreName('Anton Viljoen')).toBe(false);
    expect(
      publicEclbDisplayName({
        holderType: 'person',
        licenceHolder: 'Anton Viljoen',
        town: 'St Francis Bay',
      })
    ).toBe('Off-sales liquor store, St Francis Bay');
  });

  it('keeps a verified trading name and store-brand fascia', () => {
    expect(
      publicEclbDisplayName({
        holderType: 'person',
        licenceHolder: 'Anton Viljoen',
        town: 'St Francis Bay',
        verifiedTradingName: 'TOPS at SPAR St Francis Bay',
      })
    ).toBe('TOPS at SPAR St Francis Bay');
    expect(
      publicEclbDisplayName({
        holderType: 'store_brand',
        licenceHolder: 'Barkly East Bottle Store Cc',
        town: 'Barkly East',
      })
    ).toBe('Barkly East Bottle Store Cc');
    expect(looksLikePersonName('C.J. Robinson Liquors (Pty) Limited')).toBe(false);
    expect(isSafePublicStoreName('TOPS at SPAR St Francis Bay')).toBe(true);
  });
});

describe('ECLB merge is additive and never renames', () => {
  it('keeps every seed, curated and Google id', () => {
    const catalog = loadCatalog();
    const existing = existingCatalogWithoutGoogle();
    const google = googleCatalogPois();
    expect(existing.every((poi) => catalog.some((row) => row.id === poi.id))).toBe(true);
    expect(google.every((poi) => catalog.some((row) => row.id === poi.id))).toBe(true);
    expect(catalog.length).toBe(
      existing.length + google.length + NEW_POIS.pois.length + WCLA_NEW.pois.length
    );
  });

  it('does not create a new pin when an existing store already matches', () => {
    expect(NEW_POIS.pois.some((poi) => poi.id === 'eclb-875')).toBe(false);
    expect(catalogName('gplaces-ChIJJwPT3kkkex4R1IQxA1mwgdE')).toBe(
      'Prestons Liquor Stores Fairbridge Heights'
    );
  });

  it('never uses Anton Viljoen as a map-facing name', () => {
    const catalog = loadCatalog();
    expect(catalog.every((poi) => !/anton viljoen/i.test(poi.name))).toBe(true);
    const tops = catalog.find((poi) => poi.id === 'eclb-7');
    expect(tops?.name).toBe('TOPS at SPAR St Francis Bay');
    expect(tops?.source).toBe('eclb');
    expect(tops?.eclbLicenceHolder).toBe('Anton Viljoen');
  });

  it('new pins are eclb-sourced and use safe public names', () => {
    const catalog = loadCatalog();
    const eclb = catalog.filter((poi) => poi.source === 'eclb');
    expect(eclb.length).toBe(NEW_POIS.pois.length);
    expect(eclb.map((poi) => poi.id).sort()).toEqual(
      [...NEW_POIS.pois.map((poi) => poi.id)].sort()
    );
    expect(eclb.every((poi) => isSafePublicStoreName(poi.name))).toBe(true);
    expect(eclb.every((poi) => !looksLikePersonName(poi.name))).toBe(true);
    expect(catalog.find((poi) => poi.id === 'eclb-239')?.name).toBe('Barkly East Bottle Store');
    expect(catalog.find((poi) => poi.id === 'eclb-7')?.name).toBe('TOPS at SPAR St Francis Bay');
    expect(NEW_POIS.pois.some((poi) => poi.id === 'eclb-58')).toBe(false);
    expect(NEW_POIS.pois.some((poi) => poi.id === 'eclb-326')).toBe(false);
    expect(NEW_POIS.pois.some((poi) => poi.id === 'eclb-1180')).toBe(false);
    expect(NEW_POIS.pois.some((poi) => poi.id === 'eclb-43')).toBe(false);
    expect(NEW_POIS.pois.some((poi) => poi.id === 'eclb-487')).toBe(false);
    expect(NEW_POIS.pois.some((poi) => poi.id === 'eclb-1135')).toBe(false);
    expect(catalog.find((poi) => poi.id === 'eclb-95')?.name).toBe(
      'Africa Bottle Store Blue Bottle Liquors'
    );
    expect(catalog.find((poi) => poi.id === 'eclb-95')?.eclbLicenceHolder).toBe('Mxolisi Christin');
    expect(catalog.every((poi) => !/mxolisi christin/i.test(poi.name))).toBe(true);
    const aberdeen = catalog.find((poi) => poi.id === 'eclb-201');
    expect(aberdeen?.name).toBe('Aberdeen Bottle Store');
    expect(aberdeen?.eclbLicenceHolder).toBe('Frederick Johannes Stewart');
    expect(aberdeen?.name).not.toMatch(/stewart/i);
    expect(aberdeen?.name).not.toMatch(/blue bottle/i);
    expect(catalog.every((poi) => !/frederick johannes stewart/i.test(poi.name))).toBe(true);
    expect(catalog.find((poi) => poi.id === 'eclb-304')?.address).toMatch(/28 Bell/i);
    expect(catalog.find((poi) => poi.id === 'eclb-304')?.address).not.toMatch(/48 Bell/i);
    expect(catalog.find((poi) => poi.id === 'eclb-478')?.address).toMatch(/Flagstaff Square/i);
    expect(catalog.find((poi) => poi.id === 'eclb-478')?.address).not.toMatch(/Godlwana/i);
    expect(NEW_POIS.pois.some((poi) => poi.id === 'eclb-1092')).toBe(false);
    expect(NEW_POIS.pois.some((poi) => poi.id === 'eclb-1146')).toBe(false);
    const kirkwoodTops = catalog.find((poi) => poi.id === 'eclb-908');
    expect(kirkwoodTops?.name).toBe('TOPS at SPAR Kirkwood');
    expect(kirkwoodTops?.address).toMatch(/15 Main/i);
    expect(kirkwoodTops?.name).not.toMatch(/blue bottle/i);
    const kirkwoodShoprite = catalog.find((poi) => poi.id === 'eclb-910');
    expect(kirkwoodShoprite?.name).toBe('Shoprite LiquorShop Kirkwood');
    expect(kirkwoodShoprite?.address).toMatch(/Market/i);
    const dimbaza = catalog.find((poi) => poi.id === 'eclb-343');
    expect(dimbaza?.name).toBe('Dimbaza Bottle Store');
    expect(dimbaza?.address).toMatch(/661 Stand/i);
    expect(dimbaza?.name).not.toMatch(/shdt/i);
    expect(dimbaza?.name).not.toMatch(/hebe/i);
    expect(dimbaza?.eclbLicenceHolder).toMatch(/Shdt/i);
    const stutterheim = catalog.find((poi) => poi.id === 'eclb-1298');
    expect(stutterheim?.name).toBe("Big Daddy's Cash & Carry Stutterheim");
    expect(stutterheim?.address).toMatch(/Maclean/i);
    expect(stutterheim?.name).not.toMatch(/sparks/i);
    expect(stutterheim?.eclbLicenceHolder).toMatch(/Sparks Liquor Cc/i);
    expect(catalog.find((poi) => poi.id === 'eclb-459')?.name).toBe('Boxer Liquors Elliotdale');
    expect(catalog.find((poi) => poi.id === 'eclb-459')?.address).toMatch(/17 Main/i);
    expect(NEW_POIS.pois.some((poi) => poi.id === 'eclb-460')).toBe(false);
    expect(
      catalog.find((poi) => poi.id === 'gplaces-ChIJP4FG4kOwZh4REmzc-vYpg88')?.name
    ).toBe('King Bottle Store');
    expect(NEW_POIS.pois.every((poi) => poi.id !== 'eclb-king-bottle')).toBe(true);
    expect(catalog.every((poi) => !/^s m hebe$/i.test(poi.name))).toBe(true);
  });

  it('confirmed matches keep the existing public name and attach the holder in the backend', () => {
    const catalog = loadCatalog();
    const byId = new Map(catalog.map((poi) => [poi.id, poi]));
    for (const row of ENRICHMENT.enrichment) {
      const poi = byId.get(row.existingId);
      expect(poi, row.existingId).toBeTruthy();
      expect(poi?.eclbLicenceHolder).toBe(row.eclbLicenceHolder);
      expect(poi?.eclbId).toBe(row.eclbId);
      if (row.eclbHolderType === 'person') {
        expect(poi!.name.toLowerCase()).not.toBe(row.eclbLicenceHolder.toLowerCase());
        expect(poi!.name.toLowerCase()).not.toContain('anton viljoen');
      }
    }

    const oxford = byId.get('gplaces-ChIJQWUTTQDhZh4RTYmdpSfdm04');
    expect(oxford?.name).toBe('Ultra Liquors Oxford');
    expect(oxford?.eclbLicenceHolder).toBe('C.J. Robinson Liquors (Pty) Limited');
    expect(oxford?.address).toMatch(/248 Oxford/i);

    const youngPark = byId.get('gplaces-ChIJo5UyBfnTeh4R2tlq6FmiNw8');
    expect(youngPark?.name).toBe("Big Daddy's Liquor Stores Young Park");
    expect(youngPark?.eclbLicenceHolder).toBe('Prestons Pe Liquor Trust');

    const boxerCommercial = byId.get('gplaces-ChIJU4waD-3Teh4R_2uB210h84Q');
    expect(boxerCommercial?.name).toBe('Port Elizabeth Boxer Liquors');
    expect(boxerCommercial?.eclbLicenceHolder).toBe('Boxer Superstore (Pty) Ltd');

    const fairbridge = byId.get('gplaces-ChIJJwPT3kkkex4R1IQxA1mwgdE');
    expect(fairbridge?.name).toBe('Prestons Liquor Stores Fairbridge Heights');
    expect(fairbridge?.eclbLicenceHolder).toBe('Prestons Pe Liquor Trust');

    const portAlfred = byId.get('gplaces-ChIJ2aC1qfTLZR4RxbmAn08LAXs');
    expect(portAlfred?.name).toBe('Prestons Liquor Stores Port Alfred');
    expect(portAlfred?.eclbLicenceHolder).toBe('Prestons Liquors Pe Trust');
  });
});

describe('discoverLocal surfaces ECLB gap pins without leaking holder names', () => {
  it('points at TOPS at SPAR in St Francis Bay, not Anton Viljoen', () => {
    const result = discoverLocal(-34.1615, 24.8285, 2500);
    expect(result.stores.some((store) => store.name === 'TOPS at SPAR St Francis Bay')).toBe(true);
    expect(result.stores.every((store) => !/anton viljoen/i.test(store.name))).toBe(true);
    expect(result.stores.some((store) => store.source === 'eclb')).toBe(true);
  });

  it('points at Barkly East Bottle Store from the new ECLB pin', () => {
    const result = discoverLocal(-30.96807, 27.59428, 1500);
    const store = result.stores.find((row) => row.id === 'eclb-239');
    expect(store?.name).toBe('Barkly East Bottle Store');
    expect(store?.source).toBe('eclb');
  });
});

function catalogName(id: string): string | undefined {
  return loadCatalog().find((poi) => poi.id === id)?.name;
}
