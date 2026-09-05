import { describe, it, expect } from 'vitest';
import { discoverLocal } from '../discovery';
import {
  existingCatalogWithoutGoogle,
  googleCatalogPois,
  loadCatalog,
  resetCatalogCache,
} from '../poiCatalog';
import { applyAdditiveInserts, assertAdditive, sourceStateAllowsDeletion } from '../poiIntegrity';
import {
  publicWclaDisplayName,
  looksLikePersonName,
  isSafePublicStoreName,
  type WclaEnrichmentFile,
  type WclaNewPoiFile,
} from '../wcla';
import wclaNew from '../../data/wclaNewPois.json';
import wclaEnrichment from '../../data/wclaEnrichment.json';
import eclbNew from '../../data/eclbNewPois.json';
import type { EclbNewPoiFile } from '../eclb';

const NEW_POIS = wclaNew as WclaNewPoiFile;
const ENRICHMENT = wclaEnrichment as WclaEnrichmentFile;
const ECLB_NEW = eclbNew as EclbNewPoiFile;

const BEFORE_IDS = [
  ...existingCatalogWithoutGoogle().map((poi) => poi.id),
  ...googleCatalogPois().map((poi) => poi.id),
];

describe('TEST 1 — zero deletion', () => {
  it('keeps every seed, curated, Google and ECLB id after the WCLA pass', () => {
    resetCatalogCache();
    const catalog = loadCatalog();
    const after = new Set(catalog.map((poi) => poi.id));
    for (const id of BEFORE_IDS) {
      expect(after.has(id)).toBe(true);
    }
    expect(catalog.some((poi) => poi.source === 'eclb')).toBe(true);
    assertAdditive(
      BEFORE_IDS,
      catalog.map((poi) => poi.id),
      'wcla-pass'
    );
    expect(catalog.length).toBe(BEFORE_IDS.length + ECLB_NEW.pois.length + NEW_POIS.pois.length);
  });
});

describe('TEST 2 — match not duplicate', () => {
  it('matches Liberty Liquor Store Athlone to the existing Google pin', () => {
    const row = ENRICHMENT.enrichment.find((e) => e.wclaLicenceNo === 'WCP/000515');
    expect(row?.existingId).toBe('gplaces-ChIJte7f_cRdzB0RRRdUcZPEifs');
    expect(NEW_POIS.pois.some((poi) => /liberty/i.test(poi.name))).toBe(false);
    const catalog = loadCatalog();
    const pin = catalog.find((poi) => poi.id === 'gplaces-ChIJte7f_cRdzB0RRRdUcZPEifs');
    expect(pin?.name).toBe('Liberty Liquors Athlone');
    expect(pin?.wclaLicenceNo).toBe('WCP/000515');
  });

  it('matches Erica Tops to TOPS at SPAR Erica instead of adding a pin', () => {
    const row = ENRICHMENT.enrichment.find((e) => e.wclaLicenceNo === 'WCP/041756');
    expect(row?.existingId).toBe('gplaces-ChIJU-FfiARQzB0Rk0_x4s1c3z0');
    expect(NEW_POIS.pois.some((poi) => /erica/i.test(poi.name))).toBe(false);
  });

  it('matches Fairdeal Liquors Blue Downs to the existing Google pin', () => {
    const row = ENRICHMENT.enrichment.find((e) => e.wclaLicenceNo === 'WCP/043917');
    expect(row?.existingId).toBe('gplaces-ChIJqe8emkVPzB0R1srM9jPa0zw');
    expect(NEW_POIS.pois.filter((poi) => /fairdeal/i.test(poi.name))).toHaveLength(0);
    const catalog = loadCatalog();
    expect(catalog.find((poi) => poi.id === 'gplaces-ChIJqe8emkVPzB0R1srM9jPa0zw')?.name).toBe(
      'Fairdeal Liquors'
    );
    expect(catalog.find((poi) => poi.id === 'osm-seed-node-11676489099')?.name).toMatch(/fairdeal/i);
  });

  it('matches Table View TOPS licences onto existing TOPS pins, not Blouberg Liquors', () => {
    expect(ENRICHMENT.enrichment.find((e) => e.wclaLicenceNo === 'WCP/042090')?.existingId).toBe(
      'osm-seed-node-6552362686'
    );
    expect(ENRICHMENT.enrichment.find((e) => e.wclaLicenceNo === 'WCP/032691')?.existingId).toBe(
      'gplaces-ChIJQZp88DtfzB0RGHXp7YuTGb0'
    );
    expect(ENRICHMENT.enrichment.find((e) => e.wclaLicenceNo === 'WCP/043772')?.existingId).toBe(
      'gplaces-ChIJtd4_1-BfzB0RRzAJU95GeCQ'
    );
    const catalog = loadCatalog();
    expect(catalog.find((poi) => poi.id === 'gplaces-ChIJEb4JSXVfzB0Rwuh1gHKeP2c')?.name).toBe(
      'Blouberg Liquors'
    );
    expect(catalog.find((poi) => poi.id === 'osm-seed-node-6552362686')?.name).toMatch(/tops/i);
  });
});

describe('TEST 3 — same brand / different address', () => {
  it('does not merge Mandi Liquors Caledon into Mandi Liquors Strand', () => {
    const catalog = loadCatalog();
    const strand = catalog.find((poi) => poi.id === 'osm-seed-node-12031395720');
    const caledon = catalog.find((poi) => poi.id === 'wcla-028887');
    expect(strand?.name).toMatch(/mandi/i);
    expect(caledon?.name).toBe('Mandi Liquors');
    expect(caledon?.city).toBe('Caledon');
    expect(strand?.id).not.toBe(caledon?.id);
  });

  it('keeps TOPS branches as separate physical stores', () => {
    const catalog = loadCatalog();
    const tops = catalog.filter((poi) => /tops/i.test(poi.name) && poi.province === 'Western Cape');
    const ids = new Set(tops.map((poi) => poi.id));
    expect(ids.size).toBe(tops.length);
    expect(tops.length).toBeGreaterThan(20);
  });

  it('keeps TOPS at SPAR 1976 and OK Liquor 1976 as two pins in the same centre', () => {
    const catalog = loadCatalog();
    const tops = catalog.find((poi) => poi.id === 'gplaces-ChIJadIpiXpXzB0Ru8CELlvVH0s');
    const ok = catalog.find((poi) => poi.id === 'gplaces-ChIJoXhpDwBXzB0R_31WccEY4aI');
    expect(tops?.name).toBe('TOPS at SPAR 1976');
    expect(ok?.name).toBe('OK Liquor 1976 Durbanville');
    expect(tops?.id).not.toBe(ok?.id);
  });
});

describe('TEST 4 — supermarket vs bottle store', () => {
  it('does not add SPAR / Checkers / Shoprite / Pick n Pay supermarket pins', () => {
    expect(NEW_POIS.pois.every((poi) => !/^(spar|checkers|shoprite|pick n pay)$/i.test(poi.name))).toBe(
      true
    );
    expect(
      NEW_POIS.pois.every(
        (poi) =>
          /liquor|bottle|tops|cellar/i.test(poi.name) || /liquor|bottle/i.test(poi.address ?? '')
      )
    ).toBe(true);
  });
});

describe('TEST 5 — Consumption Off is not enough', () => {
  it('rejects wine farms, dark stores and generic supermarkets from new pins', () => {
    expect(NEW_POIS.pois.some((poi) => /dark store/i.test(poi.name))).toBe(false);
    expect(NEW_POIS.pois.some((poi) => /wine farm|wine estate|winery/i.test(poi.name))).toBe(false);
    expect(NEW_POIS.pois.some((poi) => /^shoprite$/i.test(poi.name))).toBe(false);
  });
});

describe('TEST 6 — failure cannot delete', () => {
  it('provider failure states never allow deletion', () => {
    expect(sourceStateAllowsDeletion('SOURCE_FAILED')).toBe(false);
    expect(sourceStateAllowsDeletion('SOURCE_TIMEOUT')).toBe(false);
    expect(sourceStateAllowsDeletion('SOURCE_ZERO_RESULTS')).toBe(false);
    expect(sourceStateAllowsDeletion('SOURCE_UNAVAILABLE')).toBe(false);
  });

  it('additive insert of an empty WCLA batch leaves the catalog untouched', () => {
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
});

describe('TEST 7 — proximity is not identity', () => {
  it('adds TOPS Cape Gate as a separate pin from Makro Liquor Cape Gate', () => {
    const catalog = loadCatalog();
    const tops = catalog.find((poi) => poi.id === 'wcla-032055');
    const makro = catalog.find((poi) => poi.id === 'gplaces-ChIJ6-DvY0ZXzB0RExfsQ7sCFDk');
    expect(tops?.name).toBe('TOPS at SPAR Cape Gate');
    expect(makro?.name).toBe('Makro Liquor Cape Gate');
    expect(ENRICHMENT.enrichment.some((row) => row.wclaLicenceNo === 'WCP/032055')).toBe(false);
  });

  it('keeps three distinct Montagu bottle stores', () => {
    const catalog = loadCatalog();
    const independent = catalog.find((poi) => poi.id === 'wcla-041527');
    const shoprite = catalog.find((poi) => poi.id === 'wcla-036761');
    const tops = catalog.find((poi) => poi.id === 'wcla-035043');
    expect(independent?.name).toBe('Montagu Liquor Store');
    expect(independent?.wclaLicenceHolder).toBe('Qiangwen Chen');
    expect(independent?.name.toLowerCase()).not.toBe('qiangwen chen');
    expect(shoprite?.name).toBe('Shoprite LiquorShop Montagu');
    expect(tops?.name).toBe('TOPS at SPAR Montagu');
    expect(new Set([independent?.id, shoprite?.id, tops?.id]).size).toBe(3);
  });

  it('does not treat Checkers LiquorShop Montagu Village in Blanco as a Montagu town store', () => {
    expect(NEW_POIS.pois.some((poi) => /montagu village/i.test(poi.name))).toBe(false);
    expect(ENRICHMENT.enrichment.find((e) => e.wclaLicenceNo === 'WCP/045297')?.existingId).toBe(
      'gplaces-ChIJj8cl1gkP1h0RTgIFJOEeMDI'
    );
  });
});

describe('WCLA public naming and discovery', () => {
  it('never uses a personal licence holder as the map name', () => {
    expect(looksLikePersonName('Qiangwen Chen')).toBe(true);
    expect(isSafePublicStoreName('Montagu Liquor Store')).toBe(true);
    expect(
      publicWclaDisplayName({
        holderType: 'person',
        licenceHolder: 'Qiangwen Chen',
        premisesName: 'Montagu Liquor Store',
        town: 'Montagu',
      })
    ).toBe('Montagu Liquor Store');
  });

  it('surfaces new WCLA pins locally without renaming existing stores', () => {
    const saxon = discoverLocal(-33.58982, 18.50974, 1500);
    expect(saxon.stores.some((store) => store.id === 'wcla-002359')).toBe(true);
    expect(saxon.stores.find((store) => store.id === 'wcla-002359')?.name).toBe(
      'Saxon World Liquor Store'
    );
    const montagu = discoverLocal(-33.78612, 20.12333, 1500);
    expect(montagu.stores.find((store) => store.id === 'wcla-041527')?.name).toBe(
      'Montagu Liquor Store'
    );
    expect(montagu.stores.find((store) => store.id === 'wcla-036761')?.name).toBe(
      'Shoprite LiquorShop Montagu'
    );
    expect(montagu.stores.find((store) => store.id === 'wcla-035043')?.name).toBe(
      'TOPS at SPAR Montagu'
    );
    expect(montagu.stores.every((store) => !/qiangwen chen/i.test(store.name))).toBe(true);
  });

  it('new pins are wcla-sourced and use safe public names', () => {
    const catalog = loadCatalog();
    const wcla = catalog.filter((poi) => poi.source === 'wcla');
    expect(wcla.length).toBe(NEW_POIS.pois.length);
    expect(wcla.every((poi) => isSafePublicStoreName(poi.name))).toBe(true);
    expect(catalog.find((poi) => poi.id === 'wcla-002359')?.name).toBe('Saxon World Liquor Store');
    expect(catalog.find((poi) => poi.id === 'wcla-011433')?.name).toBe('Lucky Strike Bottle Store');
    expect(catalog.find((poi) => poi.id === 'wcla-021431')?.name).toBe('Danabaai Liquor Store');
    expect(catalog.find((poi) => poi.id === 'wcla-032055')?.name).toBe('TOPS at SPAR Cape Gate');
    expect(catalog.find((poi) => poi.id === 'wcla-035987')?.name).toBe(
      'TOPS at SPAR Flamingo Square'
    );
  });
});
