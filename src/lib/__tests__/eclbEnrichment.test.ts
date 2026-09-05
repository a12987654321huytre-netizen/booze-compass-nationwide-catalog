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
import type { EclbEnrichmentFile, EclbNewPoiFile } from '../eclb';

const NEW_POIS = eclbNew as EclbNewPoiFile;
const ENRICHMENT = eclbEnrichment as EclbEnrichmentFile;

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
    expect(catalog.length).toBe(existing.length + google.length + NEW_POIS.pois.length);
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
    expect(eclb).toHaveLength(2);
    expect(eclb.map((poi) => poi.id).sort()).toEqual(['eclb-239', 'eclb-7']);
    expect(eclb.every((poi) => isSafePublicStoreName(poi.name))).toBe(true);
    expect(eclb.every((poi) => !looksLikePersonName(poi.name))).toBe(true);
    expect(catalog.find((poi) => poi.id === 'eclb-239')?.name).toBe('Barkly East Bottle Store');
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
