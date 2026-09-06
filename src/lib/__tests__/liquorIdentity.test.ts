import { describe, it, expect } from 'vitest';
import { resolveStoreIdentity, isParentBusinessName } from '../liquorIdentity';

describe('resolveStoreIdentity - generic name vs real brand', () => {
  it('prefers brand Village Liquors over generic name Liquor Store', () => {
    const result = resolveStoreIdentity({
      name: 'Liquor Store',
      brand: 'Village Liquors',
      shop: 'alcohol',
    });
    expect(result.name).toBe('Village Liquors');
    expect(result.identitySource).toContain('brand');
  });

  it('uses operator when it is the only liquor-specific identity', () => {
    const result = resolveStoreIdentity({
      shop: 'alcohol',
      operator: 'Heldervue Liquor Store',
    });
    expect(result.name).toBe('Heldervue Liquor Store');
  });

  it('uses official_name when name is generic', () => {
    const result = resolveStoreIdentity({
      name: 'Bottle Store',
      official_name: 'King Liquor',
      shop: 'alcohol',
    });
    expect(result.name).toBe('King Liquor');
  });
});

describe('resolveStoreIdentity - parent supermarket vs liquor outlet', () => {
  it('does NOT call a Woolworths supermarket Woolworths Cellar just because operator matches', () => {
    // Classification would reject this candidate. Identity still must not
    // invent a Cellar name if we asked it not to treat it as liquor.
    const result = resolveStoreIdentity(
      { name: 'Woolworths', operator: 'Woolworths', shop: 'supermarket' },
      { classifiedAsLiquor: false }
    );
    expect(result.name).toBe('Woolworths');
    expect(result.name).not.toBe('Woolworths Cellar');
  });

  it('does NOT infer WCellar from a Woolworths supermarket even if tagged shop=alcohol', () => {
    const result = resolveStoreIdentity(
      { name: 'Woolworths', shop: 'alcohol' },
      { classifiedAsLiquor: true }
    );
    expect(result.name).toBe('Woolworths');
    expect(result.name).not.toBe('Woolworths Cellar');
  });

  it('does NOT infer WCellar from Woolworths Eikestad Mall', () => {
    const result = resolveStoreIdentity(
      { name: 'Woolworths Eikestad Mall', shop: 'alcohol' },
      { classifiedAsLiquor: true }
    );
    expect(result.name).toBe('Woolworths Eikestad Mall');
    expect(result.name).not.toBe('Woolworths Cellar');
  });

  it('keeps Food Lover\'s Market as the parent, not the liquor identity', () => {
    expect(isParentBusinessName("Food Lover's Market")).toBe(true);
    expect(isParentBusinessName('Woolworths')).toBe(true);
    expect(isParentBusinessName('Woolworths Cellar')).toBe(false);
    expect(isParentBusinessName('Market Liquor')).toBe(false);
  });

  it('prefers LiquorShop Checkers over brand=Checkers', () => {
    const result = resolveStoreIdentity({
      name: 'LiquorShop Checkers',
      brand: 'Checkers',
      shop: 'alcohol',
    });
    expect(result.name.toLowerCase()).toContain('liquor');
    expect(result.name).not.toBe('Checkers');
  });

  it('expands W Cellar to Woolworths Cellar', () => {
    const result = resolveStoreIdentity({ name: 'W Cellar', shop: 'alcohol' });
    expect(result.name).toBe('Woolworths Cellar');
  });

  it('prefers brand Tops at Spar over short name Tops', () => {
    const result = resolveStoreIdentity({
      name: 'Tops',
      brand: 'Tops at Spar',
      short_name: 'Tops',
      shop: 'alcohol',
    });
    expect(result.name.toLowerCase()).toContain('spar');
  });

  it('rewrites Pick n Pay Family to Pick n Pay Liquor when already classified as liquor', () => {
    const result = resolveStoreIdentity(
      { name: 'Pick n Pay Family Braamfontein', shop: 'alcohol' },
      { classifiedAsLiquor: true }
    );
    expect(result.name).toBe('Pick n Pay Liquor');
    expect(result.parentName).toBe('Pick n Pay');
    expect(result.locationType).toBe('attached-counter');
  });

  it('does not invent a liquor banner for a Pick n Pay grocery', () => {
    const result = resolveStoreIdentity(
      { name: 'Pick n Pay Family Braamfontein', shop: 'supermarket' },
      { classifiedAsLiquor: false }
    );
    expect(result.name).toBe('Pick n Pay Family Braamfontein');
    expect(result.name).not.toBe('Pick n Pay Liquor');
  });
});

describe('resolveStoreIdentity - curated wins', () => {
  it('uses the curated name when provided', () => {
    const result = resolveStoreIdentity(
      { name: 'Woolworths', shop: 'supermarket' },
      {
        curatedName: 'Woolworths Cellar',
        curatedType: 'attached-counter',
        curatedParentName: 'Woolworths',
      }
    );
    expect(result.name).toBe('Woolworths Cellar');
    expect(result.identitySource).toBe('curated');
    expect(result.parentName).toBe('Woolworths');
  });
});
