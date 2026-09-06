import { describe, it, expect } from 'vitest';
import { discoverLocal } from '../discovery';
import { TEST_LOCATIONS } from '../../data/testLocations';

describe('discoverLocal - Cape Town / Stellenbosch seed + curated', () => {
  it('finds real Stellenbosch CBD bottle stores without hitting Overpass', () => {
    const loc = TEST_LOCATIONS.find((l) => l.id === 'stellenbosch-cbd')!;
    const result = discoverLocal(loc.latitude, loc.longitude, 2000);
    const names = result.stores.map((s) => s.name.toLowerCase());
    expect(result.stores.length).toBeGreaterThan(0);
    expect(names.some((n) => n.includes('pick n pay liquor') || n.includes('liquor city') || n.includes('picardi'))).toBe(
      true
    );
    // Parent supermarket must not beat the liquor outlet.
    expect(names.includes('woolworths')).toBe(false);
  });

  it('names Village Liquors correctly', () => {
    const loc = TEST_LOCATIONS.find((l) => l.id === 'village-liquors')!;
    const result = discoverLocal(loc.latitude, loc.longitude, 800);
    expect(result.stores.some((s) => s.name === 'Village Liquors')).toBe(true);
  });

  it('does not infer WCellar from the Stellenbosch CBD Woolworths supermarket', () => {
    const loc = TEST_LOCATIONS.find((l) => l.id === 'stellenbosch-cbd')!;
    const result = discoverLocal(loc.latitude, loc.longitude, 1500);
    expect(result.stores.some((s) => s.id === 'curated-ww-cellar-stellenbosch-cbd')).toBe(false);
    expect(result.stores.some((s) => s.source === 'curated' && s.name === 'Woolworths Cellar')).toBe(
      false
    );
    expect(result.stores.some((s) => /^woolworths$/i.test(s.name))).toBe(false);
  });

  it('surfaces Market Liquor as an attached counter of Food Lover\'s Market', () => {
    const result = discoverLocal(-33.91747, 18.42365, 800);
    const market = result.stores.find((s) => s.name === 'Market Liquor');
    expect(market).toBeTruthy();
    expect(market?.parentName).toBe("Food Lover's Market");
    expect(market?.locationType).toBe('attached-counter');
  });

  it('does not point at wine estates as the nearest bottle store in Stellenbosch', () => {
    const loc = TEST_LOCATIONS.find((l) => l.id === 'stellenbosch-cbd')!;
    const result = discoverLocal(loc.latitude, loc.longitude, 5000);
    const names = result.stores.map((s) => s.name.toLowerCase());
    expect(names.some((n) => n.includes('winery') || n.includes('wine estate'))).toBe(false);
  });

  it('renames W Cellar to Woolworths Cellar', () => {
    const result = discoverLocal(-33.97716, 18.84275, 400);
    expect(result.stores.some((s) => s.name === 'Woolworths Cellar')).toBe(true);
    expect(result.stores.some((s) => s.name === 'W Cellar')).toBe(false);
  });
});

describe('discoverLocal - nationwide catalog, not Cape Town-only', () => {
  it('finds bottle stores in Johannesburg without Overpass', () => {
    const loc = TEST_LOCATIONS.find((l) => l.id === 'johannesburg-cbd')!;
    const result = discoverLocal(loc.latitude, loc.longitude, 3000);
    expect(result.stores.length).toBeGreaterThan(0);
    const names = result.stores.map((s) => s.name.toLowerCase());
    expect(
      names.some(
        (n) =>
          n.includes('liquor') ||
          n.includes('tops') ||
          n.includes('bottle')
      )
    ).toBe(true);
  });

  it('finds bottle stores in Polokwane, Kimberley and Durban', () => {
    for (const id of ['polokwane', 'kimberley', 'durban-cbd']) {
      const loc = TEST_LOCATIONS.find((l) => l.id === id)!;
      const result = discoverLocal(loc.latitude, loc.longitude, 5000);
      expect(result.stores.length, id).toBeGreaterThan(0);
    }
  });

  it('does not point at Wellington Wine Route as a bottle store', () => {
    const result = discoverLocal(-33.92218, 18.44096, 800);
    expect(result.stores.some((s) => /wine route/i.test(s.name))).toBe(false);
  });
});
