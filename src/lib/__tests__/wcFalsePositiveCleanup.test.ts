import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { discoverLocal } from '../discovery';
import { loadCatalog, resetCatalogCache } from '../poiCatalog';
import { scoreLiquorCandidate } from '../liquorScoring';
import { resolveStoreIdentity } from '../liquorIdentity';
import { sourceStateAllowsDeletion } from '../poiIntegrity';
import wclaNew from '../../data/wclaNewPois.json';
import wclaEnrichment from '../../data/wclaEnrichment.json';
import type { WclaNewPoiFile, WclaEnrichmentFile } from '../wcla';

const ART = resolve(__dirname, '../../../artifacts');
const CLEANUP = JSON.parse(readFileSync(resolve(ART, 'wc-false-positive-cleanup.json'), 'utf8')) as {
  removedFromCatalogIds: string[];
  wineFarm: { id: string; name: string }[];
  nonRetail: { id: string; name: string }[];
  residentialReview: { id: string; name: string }[];
};
const NEW_POIS = wclaNew as WclaNewPoiFile;
const ENRICHMENT = wclaEnrichment as WclaEnrichmentFile;

describe('Western Cape false-positive cleanup', () => {
  it('removes SALBA, Cape Cork Supply and Stellenbosch Street Soirees from the catalog', () => {
    resetCatalogCache();
    const catalog = loadCatalog();
    expect(catalog.some((poi) => /salba/i.test(poi.name))).toBe(false);
    expect(catalog.some((poi) => /cape cork/i.test(poi.name))).toBe(false);
    expect(catalog.some((poi) => /soiree/i.test(poi.name))).toBe(false);
    expect(catalog.some((poi) => poi.id === 'gplaces-ChIJO1D5VFmyzR0Rp5YYXUxdR2c')).toBe(false);
  });

  it('does not infer WCellar from an ordinary Woolworths', () => {
    expect(loadCatalog().some((poi) => poi.id === 'curated-ww-cellar-stellenbosch-cbd')).toBe(false);
    const identity = resolveStoreIdentity(
      { name: 'Woolworths Eikestad Mall', shop: 'alcohol' },
      { classifiedAsLiquor: true }
    );
    expect(identity.name).not.toBe('Woolworths Cellar');
    expect(scoreLiquorCandidate({ shop: 'alcohol' }, 'Woolworths Eikestad Mall').accepted).toBe(false);
  });

  it('collapses Stellenbosch Square WCellar onto the existing OSM W Cellar pin', () => {
    expect(NEW_POIS.pois.some((poi) => poi.id === 'wcla-044152')).toBe(false);
    const row = ENRICHMENT.enrichment.find((e) => e.wclaLicenceNo === 'WCP/044152');
    expect(row?.existingId).toBe('osm-seed-node-13452712711');
    const catalog = loadCatalog();
    const osm = catalog.find((poi) => poi.id === 'osm-seed-node-13452712711');
    expect(osm).toBeTruthy();
    expect(osm?.wclaLicenceNo).toBe('WCP/044152');
    expect(catalog.filter((poi) => /stellenbosch square/i.test(poi.name)).length).toBeLessThanOrEqual(1);
    const nearby = discoverLocal(-33.97716, 18.84275, 400);
    const cellars = nearby.stores.filter((s) => /cellar|wcellar/i.test(s.name));
    expect(cellars.length).toBe(1);
  });

  it('moves Binta\'s Liquors off the map into review', () => {
    expect(NEW_POIS.pois.some((poi) => poi.id === 'wcla-035543')).toBe(false);
    expect(loadCatalog().some((poi) => /binta/i.test(poi.name))).toBe(false);
  });

  it('does not point at Stellenbosch wine farms or SALBA from the CBD', () => {
    const result = discoverLocal(-33.9321, 18.8602, 8000);
    const names = result.stores.map((s) => s.name.toLowerCase());
    expect(names.some((n) => n.includes('salba'))).toBe(false);
    expect(names.some((n) => n.includes('cape cork'))).toBe(false);
    expect(names.some((n) => n.includes('soiree'))).toBe(false);
    expect(names.some((n) => n.includes('vineyard') || n.includes('wine estate') || n.includes('winery'))).toBe(
      false
    );
    expect(names.some((n) => n.includes('seven sisters'))).toBe(false);
  });

  it('keeps genuine Stellenbosch bottle stores', () => {
    const catalog = loadCatalog();
    expect(catalog.find((poi) => poi.id === 'gplaces-ChIJS3pi2mCyzR0RjAzeG1fiyRY')?.name).toMatch(/picardi/i);
    expect(catalog.find((poi) => poi.id === 'wcla-002098')?.name).toMatch(/pick n pay liquor/i);
    expect(catalog.find((poi) => poi.id === 'gplaces-ChIJIcNtYGCyzR0RxBT_z0xEH_w')?.name).toMatch(/parade/i);
    expect(catalog.find((poi) => poi.id === 'wcla-036481')?.name).toMatch(/liquor king/i);
  });

  it('does not treat a liquor-sounding residential name as enough on its own', () => {
    const result = scoreLiquorCandidate(
      { shop: 'alcohol', 'addr:full': '62 Cedile Road, Stellenbosch' },
      "Binta's Liquors"
    );
    // Name is dedicated, so scoring still accepts — eligibility is the missing storefront.
    expect(result.accepted).toBe(true);
    expect(loadCatalog().some((poi) => poi.id === 'wcla-035543')).toBe(false);
  });

  it('provider failure still cannot delete', () => {
    expect(sourceStateAllowsDeletion('SOURCE_FAILED')).toBe(false);
    expect(CLEANUP.removedFromCatalogIds).toHaveLength(44);
  });
});
