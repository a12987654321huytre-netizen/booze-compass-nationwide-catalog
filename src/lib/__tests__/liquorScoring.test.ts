import { describe, it, expect } from 'vitest';
import { scoreLiquorCandidate, LIQUOR_CONFIDENCE_THRESHOLD } from '../liquorScoring';

describe('scoreLiquorCandidate - explicit OSM tags', () => {
  it('scores shop=alcohol at 100', () => {
    const result = scoreLiquorCandidate({ shop: 'alcohol' }, 'Some Bottle Store');
    expect(result.score).toBe(100);
    expect(result.accepted).toBe(true);
  });

  it('scores shop=wine at 90', () => {
    const result = scoreLiquorCandidate({ shop: 'wine' }, 'La Cave');
    expect(result.score).toBe(90);
    expect(result.accepted).toBe(true);
  });

  it('scores shop=beverages + alcohol=yes at 90', () => {
    const result = scoreLiquorCandidate({ shop: 'beverages', alcohol: 'yes' }, 'Drinks Depot');
    expect(result.score).toBe(90);
    expect(result.accepted).toBe(true);
  });

  it('does not score shop=beverages alone (no alcohol tag) as a liquor tag signal', () => {
    const result = scoreLiquorCandidate({ shop: 'beverages' }, 'Just A Drinks Shop');
    expect(result.score).toBe(0);
    expect(result.accepted).toBe(false);
  });
});

describe('scoreLiquorCandidate - the real Stellenbosch case: Liquor King', () => {
  it('accepts "Liquor King" tagged only as a plain convenience store (no alcohol tag at all)', () => {
    const result = scoreLiquorCandidate({ shop: 'convenience' }, 'Liquor King');
    expect(result.accepted).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(LIQUOR_CONFIDENCE_THRESHOLD);
    expect(result.reasons.some((r) => r.signal.includes('known SA liquor brand'))).toBe(true);
  });

  it('accepts "Liquor King" with no shop tag at all', () => {
    const result = scoreLiquorCandidate({}, 'Liquor King Khayamandi');
    expect(result.accepted).toBe(true);
  });

  it('accepts Village Liquors', () => {
    const result = scoreLiquorCandidate({ shop: 'alcohol' }, 'Village Liquors');
    expect(result.accepted).toBe(true);
  });

  it('accepts King Liquor via brand list', () => {
    const result = scoreLiquorCandidate({ shop: 'convenience' }, 'King Liquor');
    expect(result.accepted).toBe(true);
  });
});

describe('scoreLiquorCandidate - known brand name', () => {
  it('scores a known SA brand name match at 95', () => {
    const result = scoreLiquorCandidate({ shop: 'convenience' }, 'TOPS at SPAR');
    expect(result.score).toBe(95);
    expect(result.accepted).toBe(true);
  });
});

describe('scoreLiquorCandidate - generic name keyword', () => {
  it('scores a generic liquor-related name fragment at 85', () => {
    const result = scoreLiquorCandidate({ shop: 'general' }, "Jan's Bottle Store");
    expect(result.score).toBe(85);
    expect(result.accepted).toBe(true);
  });
});

describe('scoreLiquorCandidate - supermarket/convenience with an explicit alcohol tag', () => {
  it('scores a supermarket with alcohol=yes at 75 (attached counter, lower confidence)', () => {
    const result = scoreLiquorCandidate({ shop: 'supermarket', alcohol: 'yes' }, 'Some Supermarket');
    expect(result.score).toBe(75);
    expect(result.accepted).toBe(true);
  });
});

describe('scoreLiquorCandidate - must NOT classify every supermarket as a liquor store', () => {
  it('rejects a plain Shoprite with no alcohol tag and no liquor branding', () => {
    const result = scoreLiquorCandidate({ shop: 'supermarket' }, 'Shoprite Stellenbosch');
    expect(result.score).toBe(0);
    expect(result.accepted).toBe(false);
  });

  it('rejects a KWIKSPAR supermarket without a liquor banner', () => {
    const result = scoreLiquorCandidate({ shop: 'alcohol' }, 'KWIKSPAR De Helderbosch');
    expect(result.accepted).toBe(false);
    expect(result.rejectedAs).toBe('bare-supermarket');
  });

  it('rejects a Pick n Pay with no liquor signal', () => {
    const result = scoreLiquorCandidate({ shop: 'supermarket' }, 'Pick n Pay Eikestad Mall');
    expect(result.accepted).toBe(false);
  });

  it('rejects a grocery that Google typed as liquor_store', () => {
    const result = scoreLiquorCandidate({ shop: 'alcohol' }, 'Pick n Pay Family Braamfontein');
    expect(result.accepted).toBe(false);
    expect(result.rejectedAs).toBe('bare-supermarket');
  });

  it('rejects a liquor tavern that is a drinking venue, not a bottle store', () => {
    const result = scoreLiquorCandidate({ shop: 'alcohol' }, 'Mokwena Liquor Tavern');
    expect(result.accepted).toBe(false);
    expect(result.rejectedAs).toBe('not-retail');
  });

  it('rejects a takeaway Google typed as liquor_store', () => {
    const result = scoreLiquorCandidate({ shop: 'alcohol' }, "Shampie's Takeaway");
    expect(result.accepted).toBe(false);
  });

  it('still accepts a mixed butchery that is also a bottle store', () => {
    const result = scoreLiquorCandidate({ shop: 'alcohol' }, 'Nameng Butchery Bottle Store');
    expect(result.accepted).toBe(true);
  });

  it('still accepts Shoprite LiquorShop', () => {
    const result = scoreLiquorCandidate({ shop: 'alcohol' }, 'Shoprite LiquorShop Eloff Street');
    expect(result.accepted).toBe(true);
  });

  it('rejects a plain Woolworths supermarket', () => {
    const result = scoreLiquorCandidate({ shop: 'supermarket', operator: 'Woolworths' }, 'Woolworths');
    expect(result.accepted).toBe(false);
  });

  it('rejects a plain Food Lover\'s Market with no liquor branding', () => {
    const result = scoreLiquorCandidate({ shop: 'supermarket' }, "Food Lover's Market");
    expect(result.accepted).toBe(false);
  });

  it('rejects an unrelated bakery', () => {
    const result = scoreLiquorCandidate({ shop: 'bakery' }, 'Village Bakery');
    expect(result.accepted).toBe(false);
  });
});

describe('scoreLiquorCandidate - wine estates are not bottle stores', () => {
  it('rejects Groot Constantia Winery even with shop=wine', () => {
    const result = scoreLiquorCandidate({ shop: 'wine' }, 'Groot Constantia Winery');
    expect(result.accepted).toBe(false);
    expect(result.rejectedAs).toBe('wine-estate');
  });

  it('rejects craft=winery', () => {
    const result = scoreLiquorCandidate({ shop: 'wine', craft: 'winery' }, 'Meerlust');
    expect(result.accepted).toBe(false);
  });

  it('still accepts a retail wine shop', () => {
    const result = scoreLiquorCandidate({ shop: 'alcohol' }, "Caroline's Fine Wine Cellar");
    expect(result.accepted).toBe(true);
  });

  it('rejects a wine route tourism listing even if tagged shop=alcohol', () => {
    const result = scoreLiquorCandidate({ shop: 'alcohol' }, 'Wellington Wine Route');
    expect(result.accepted).toBe(false);
    expect(result.rejectedAs).toBe('wine-estate');
  });

  it('rejects a vineyard / estate even when Google typed it liquor_store', () => {
    const result = scoreLiquorCandidate({ shop: 'alcohol' }, 'Seven Sisters Vineyards');
    expect(result.accepted).toBe(false);
    expect(result.rejectedAs).toBe('wine-estate');
  });

  it('rejects a producer shop sitting on a wine cellar address', () => {
    const result = scoreLiquorCandidate(
      { shop: 'alcohol', 'addr:full': 'Koelenhof Wine Cellar, R304 Koelenhof, Stellenbosch' },
      'The Daily Wine'
    );
    expect(result.accepted).toBe(false);
    expect(result.rejectedAs).toBe('wine-estate');
  });

  it('rejects a private cellar / appointment tasting venue', () => {
    const result = scoreLiquorCandidate({ shop: 'alcohol' }, 'Bein Private Cellar');
    expect(result.accepted).toBe(false);
    expect(result.rejectedAs).toBe('wine-estate');
  });

  it('rejects a wine tastery even when tagged shop=wine', () => {
    const result = scoreLiquorCandidate({ shop: 'wine' }, 'Peter Falke wine tastery');
    expect(result.accepted).toBe(false);
    expect(result.rejectedAs).toBe('wine-estate');
  });

  it('rejects a named estate even without the words wine/winery', () => {
    const result = scoreLiquorCandidate({ shop: 'wine' }, 'Hartenberg Estate');
    expect(result.accepted).toBe(false);
    expect(result.rejectedAs).toBe('wine-estate');
  });

  it('still accepts TOPS at a centre called The Vineyard', () => {
    const result = scoreLiquorCandidate({ shop: 'alcohol' }, 'TOPS at SPAR The Vineyard');
    expect(result.accepted).toBe(true);
  });
});

describe('scoreLiquorCandidate - industry bodies, events, suppliers are not bottle stores', () => {
  it('rejects SALBA', () => {
    const result = scoreLiquorCandidate({ shop: 'alcohol' }, 'South African Liquor Brand owners Association (SALBA)');
    expect(result.accepted).toBe(false);
    expect(result.rejectedAs).toBe('not-retail');
  });

  it('rejects a cork / packaging supplier', () => {
    const result = scoreLiquorCandidate({ shop: 'alcohol' }, 'Cape Cork Supply (Pty) Ltd');
    expect(result.accepted).toBe(false);
    expect(result.rejectedAs).toBe('not-retail');
  });

  it('rejects a street soiree / event', () => {
    const result = scoreLiquorCandidate({ shop: 'alcohol' }, 'Stellenbosch Street Soirees');
    expect(result.accepted).toBe(false);
    expect(result.rejectedAs).toBe('not-retail');
  });

  it('rejects a hotel/restaurant liquor distributor', () => {
    const result = scoreLiquorCandidate({ shop: 'alcohol' }, 'Restaurant & Hotel Liquor Distributors');
    expect(result.accepted).toBe(false);
    expect(result.rejectedAs).toBe('not-retail');
  });

  it('rejects Agesi Liquor Distributors as B2B, not a bottle store', () => {
    const result = scoreLiquorCandidate({ shop: 'alcohol' }, 'Agesi Liquor Distributors');
    expect(result.accepted).toBe(false);
    expect(result.rejectedAs).toBe('not-retail');
  });

  it('still accepts a dedicated liquor warehouse that is a walk-in store', () => {
    const result = scoreLiquorCandidate({ shop: 'alcohol' }, 'Warehouse Liquor Store');
    expect(result.accepted).toBe(true);
  });
});

describe('scoreLiquorCandidate - scores brand/operator tags, not just display name', () => {
  it('accepts a nameless shop whose brand is Ultra Liquors', () => {
    const result = scoreLiquorCandidate({ shop: 'convenience', brand: 'Ultra Liquors' });
    expect(result.accepted).toBe(true);
  });
});
