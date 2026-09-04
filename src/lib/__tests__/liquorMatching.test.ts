import { describe, it, expect } from 'vitest';
import {
  normalizeName,
  matchesKnownBrand,
  matchesGenericLiquorKeyword,
  buildLiquorNameRegex,
} from '../liquorMatching';

describe('normalizeName', () => {
  it('lowercases and collapses whitespace', () => {
    expect(normalizeName('  Liquor   KING  ')).toBe('liquor king');
  });

  it('expands & to and', () => {
    expect(normalizeName('Wine & Spirits')).toBe('wine and spirits');
  });

  it('strips punctuation and hyphens', () => {
    expect(normalizeName('Picardi-Rebel')).toBe('picardi rebel');
    expect(normalizeName("Big Daddy's Liquors")).toBe('big daddy s liquors');
  });

  it('handles a name with no spaces at all', () => {
    expect(normalizeName('LiquorKing')).toBe('liquorking');
  });
});

describe('matchesKnownBrand - Liquor King (the real Stellenbosch case)', () => {
  it('matches "Liquor King"', () => {
    expect(matchesKnownBrand('Liquor King')).toBe(true);
  });

  it('matches "Liquor Kings" (plural)', () => {
    expect(matchesKnownBrand('Liquor Kings')).toBe(true);
  });

  it('matches "LIQUOR KING" (all caps)', () => {
    expect(matchesKnownBrand('LIQUOR KING')).toBe(true);
  });

  it('matches "LiquorKing" (no space)', () => {
    expect(matchesKnownBrand('LiquorKing')).toBe(true);
  });

  it('matches "Liquor King Khayamandi" (with a suburb suffix)', () => {
    expect(matchesKnownBrand('Liquor King Khayamandi')).toBe(true);
  });

  it('matches when embedded in a longer combined name', () => {
    expect(matchesKnownBrand('Overland Liquors / Liquor King')).toBe(true);
  });
});

describe('matchesKnownBrand - other SA banners', () => {
  it('matches TOPS at SPAR', () => {
    expect(matchesKnownBrand('TOPS at SPAR Stellenbosch')).toBe(true);
  });

  it('matches Checkers LiquorShop', () => {
    expect(matchesKnownBrand('Checkers LiquorShop Die Boord')).toBe(true);
  });

  it('matches Market Liquors (Food Lover\'s Market)', () => {
    expect(matchesKnownBrand('Market Liquors')).toBe(true);
    expect(matchesKnownBrand("Food Lover's Market Liquor")).toBe(true);
    expect(matchesKnownBrand('Food Lovers Market Liquor Stellenbosch')).toBe(true);
  });

  it('does NOT match a plain Food Lover\'s Market with no liquor branding', () => {
    // The grocery store itself must not be flagged as a liquor destination.
    expect(matchesKnownBrand("Food Lover's Market")).toBe(false);
    expect(matchesKnownBrand('Food Lovers Market Eikestad')).toBe(false);
  });

  it('matches PicardiRebel and Picardi Rebel', () => {
    expect(matchesKnownBrand('PicardiRebel')).toBe(true);
    expect(matchesKnownBrand('Picardi Rebel')).toBe(true);
  });

  it('matches Ultra Liquors', () => {
    expect(matchesKnownBrand('Ultra Liquors Somerset West')).toBe(true);
  });

  it('does not match an unrelated business', () => {
    expect(matchesKnownBrand('Woolworths Food')).toBe(false);
    expect(matchesKnownBrand('Postnet Stellenbosch')).toBe(false);
  });

  it('does not match a plain supermarket with no liquor branding', () => {
    expect(matchesKnownBrand('Shoprite Stellenbosch')).toBe(false);
    expect(matchesKnownBrand('Pick n Pay Eikestad Mall')).toBe(false);
  });
});

describe('matchesGenericLiquorKeyword', () => {
  it('matches "bottle store"', () => {
    expect(matchesGenericLiquorKeyword("Jan's Bottle Store")).toBe(true);
  });

  it('matches bare "liquor"', () => {
    expect(matchesGenericLiquorKeyword('Stellenbosch Liquor Traders')).toBe(true);
  });

  it('matches Afrikaans "drankwinkel"', () => {
    expect(matchesGenericLiquorKeyword('Dorp Drankwinkel')).toBe(true);
  });

  it('matches "wine and spirits" (from "Wine & Spirits")', () => {
    expect(matchesGenericLiquorKeyword('Village Wine & Spirits')).toBe(true);
  });

  it('does not match unrelated businesses', () => {
    expect(matchesGenericLiquorKeyword('Village Bakery')).toBe(false);
    expect(matchesGenericLiquorKeyword('De Kelders Guest House')).toBe(false);
  });
});

describe('buildLiquorNameRegex', () => {
  it('produces a non-empty pattern containing known fragments', () => {
    const pattern = buildLiquorNameRegex();
    expect(pattern.length).toBeGreaterThan(0);
    expect(pattern).toContain('liquor');
  });

  it('is a valid regex', () => {
    const pattern = buildLiquorNameRegex();
    expect(() => new RegExp(pattern, 'i')).not.toThrow();
  });

  it('actually matches "Liquor King" when compiled', () => {
    const pattern = new RegExp(buildLiquorNameRegex(), 'i');
    expect(pattern.test('Liquor King')).toBe(true);
    expect(pattern.test('LiquorKing')).toBe(true);
  });
});
