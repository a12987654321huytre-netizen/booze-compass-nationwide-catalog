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
const SNAPSHOT: string[] = JSON.parse(readFileSync(resolve(ART, 'mer-id-snapshot-before.json'), 'utf8'));
const NEW_POIS: {
  id: string;
  name: string;
  address?: string;
  merLicenceHolder?: string;
  merTradingName?: string;
}[] = JSON.parse(readFileSync(resolve(ART, 'mer-new-pois.json'), 'utf8')).pois;
const REJECTED: { name?: string; tradingName?: string }[] = JSON.parse(
  readFileSync(resolve(ART, 'mer-rejected.json'), 'utf8')
);
const DISCOVERY: { merRecordsSearched: number; deleted: number; officialDataFound: boolean } = JSON.parse(
  readFileSync(resolve(ART, 'mer-discovery-report.json'), 'utf8')
);

describe('MER saturation — zero deletion', () => {
  it('keeps every pre-pass POI id and only grows by the new MER ids', () => {
    resetCatalogCache();
    const catalog = loadCatalog();
    const after = new Set(catalog.map((poi) => poi.id));
    expect(SNAPSHOT).toHaveLength(7616);
    const missing = SNAPSHOT.filter((id) => !after.has(id));
    expect(missing).toEqual([]);
    assertAdditive(
      SNAPSHOT,
      catalog.map((poi) => poi.id),
      'mer-pass'
    );
    expect(NEW_POIS.every((poi) => after.has(poi.id))).toBe(true);
    expect(catalog.length).toBe(SNAPSHOT.length + NEW_POIS.length);
    expect(NEW_POIS).toHaveLength(69);
    expect(DISCOVERY.deleted).toBe(0);
    expect(DISCOVERY.merRecordsSearched).toBe(9648);
    expect(DISCOVERY.officialDataFound).toBe(true);
  });
});

describe('MER saturation — match not duplicate', () => {
  it('does not add a second Shoprite LiquorShop Tonga from the Siyabuswa MER row', () => {
    expect(NEW_POIS.filter((poi) => /shoprite liquorshop tonga/i.test(poi.name))).toHaveLength(0);
    const catalog = loadCatalog();
    expect(catalog.filter((poi) => poi.id === 'gplaces-ChIJa3igOkYt5h4RvlXpdyWHrUk')).toHaveLength(1);
  });
});

describe('MER saturation — same brand / different address', () => {
  it('keeps Liquor City Kamaqhekeza separate from TOPS at SPAR Naas in the same centre', () => {
    const catalog = loadCatalog();
    const liquorCity = catalog.find((poi) => poi.id === 'gplaces-ChIJM-wYKtMz5h4Rvs7h0xrvniU');
    const topsNaas = catalog.find((poi) => poi.id === 'gplaces-ChIJ4RO8JEkz5h4ROxMg3DARMmw');
    expect(liquorCity?.name).toMatch(/liquor city kamaqhekeza/i);
    expect(topsNaas?.name).toMatch(/tops at spar naas/i);
    expect(liquorCity?.id).not.toBe(topsNaas?.id);
    expect(NEW_POIS.some((poi) => poi.id === liquorCity?.id)).toBe(true);
    expect(NEW_POIS.some((poi) => poi.id === topsNaas?.id)).toBe(false);
  });

  it('keeps two Liquor Legends branches as separate pins', () => {
    const balfour = NEW_POIS.find((poi) => poi.id === 'gplaces-ChIJW9NDz-fLlB4RKXmmGaPkGSc');
    const middelburg = NEW_POIS.find((poi) => poi.id === 'gplaces-ChIJJaF8qFZg6h4RFx5R03mZCvk');
    expect(balfour?.name).toMatch(/liquor legends/i);
    expect(middelburg?.name).toMatch(/liquor legends/i);
    expect(balfour?.id).not.toBe(middelburg?.id);
  });
});

describe('MER saturation — supermarket vs bottle store', () => {
  it('does not add SPAR / Checkers / Shoprite / Pick n Pay supermarket pins', () => {
    expect(NEW_POIS.every((poi) => !/^(spar|superspar|checkers|shoprite|pick n pay)$/i.test(poi.name))).toBe(
      true
    );
    expect(NEW_POIS.some((poi) => /boxer superstore/i.test(poi.name))).toBe(false);
  });

  it('does add dedicated liquor banners found in the MER gap', () => {
    expect(NEW_POIS.some((poi) => poi.id === 'gplaces-ChIJyX2UZTgD6x4R-BNpkZNMwBE')).toBe(true);
    expect(NEW_POIS.find((poi) => poi.id === 'gplaces-ChIJyX2UZTgD6x4R-BNpkZNMwBE')?.name).toBe(
      'TOPS at SPAR Mooilaan'
    );
    expect(NEW_POIS.some((poi) => poi.id === 'gplaces-ChIJex6sXDR7wB4R5U69nfUtsCw')).toBe(true);
    expect(NEW_POIS.find((poi) => poi.id === 'gplaces-ChIJex6sXDR7wB4R5U69nfUtsCw')?.name).toMatch(
      /shoprite liquorshop marapyane/i
    );
  });
});

describe('MER saturation — Consumption Off is not enough', () => {
  it('does not promote distributors, taverns, mixed butcher-delis or lodge cellars', () => {
    expect(NEW_POIS.some((poi) => /two soul/i.test(poi.name))).toBe(false);
    expect(NEW_POIS.some((poi) => /harmony liquor distributor/i.test(poi.name))).toBe(false);
    expect(NEW_POIS.some((poi) => /magalela/i.test(poi.name) && /distribution/i.test(poi.name))).toBe(false);
    expect(NEW_POIS.some((poi) => /vezubuhle/i.test(poi.name))).toBe(false);
    expect(NEW_POIS.some((poi) => /hectorspruit butchery/i.test(poi.name))).toBe(false);
    expect(NEW_POIS.some((poi) => /lukimbi/i.test(poi.name))).toBe(false);
    expect(NEW_POIS.some((poi) => /forever resort/i.test(poi.name))).toBe(false);
    expect(NEW_POIS.some((poi) => /tavern|shebeen|nightclub/i.test(poi.name))).toBe(false);
    expect(NEW_POIS.some((poi) => /wine farm|wine estate|winery/i.test(poi.name))).toBe(false);
    expect(REJECTED.some((row) => /lukimbi/i.test(row.tradingName || row.name || ''))).toBe(true);
    expect(REJECTED.some((row) => /two soul/i.test(row.tradingName || row.name || ''))).toBe(true);
  });
});

describe('MER saturation — holder names never become map names', () => {
  it('uses the premises / Google name, not the personal licence holder', () => {
    expect(NEW_POIS.some((poi) => /downing moranang makoropo/i.test(poi.name))).toBe(false);
    expect(NEW_POIS.some((poi) => /ellen buyisiwe sindane/i.test(poi.name))).toBe(false);
    expect(NEW_POIS.some((poi) => /wynand vivier/i.test(poi.name))).toBe(false);
    for (const poi of NEW_POIS) {
      const holder = (poi.merLicenceHolder || '').trim();
      if (!holder) continue;
      expect(poi.name.trim().toLowerCase()).not.toBe(holder.toLowerCase());
    }
  });
});

describe('MER saturation — source failure cannot delete', () => {
  it('provider failure states never allow deletion', () => {
    expect(sourceStateAllowsDeletion('SOURCE_FAILED')).toBe(false);
    expect(sourceStateAllowsDeletion('SOURCE_TIMEOUT')).toBe(false);
    expect(sourceStateAllowsDeletion('SOURCE_ZERO_RESULTS')).toBe(false);
    expect(sourceStateAllowsDeletion('SOURCE_UNAVAILABLE')).toBe(false);
  });

  it('additive insert of an empty MER batch leaves the catalog untouched', () => {
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

  it('google catalog file only grew by the new MER ids', () => {
    const googleIds = googleCatalogPois().map((poi) => poi.id);
    const beforeGoogle = SNAPSHOT.filter((id) => id.startsWith('gplaces-'));
    expect(beforeGoogle.every((id) => googleIds.includes(id))).toBe(true);
    expect(NEW_POIS.every((poi) => googleIds.includes(poi.id))).toBe(true);
    expect(googleIds).toHaveLength(beforeGoogle.length + NEW_POIS.length);
    expect((googlePlacesFile as { pois: unknown[] }).pois).toHaveLength(googleIds.length);
  });
});
