import type { OsmTags } from './osmFormat';
import { collectNameFields } from './osmFormat';
import {
  matchesKnownBrand,
  matchesGenericLiquorKeyword,
} from './liquorMatching';

export type ScoreReason = {
  signal: string;
  score: number;
};

export type LiquorScoreResult = {
  score: number;
  accepted: boolean;
  reasons: ScoreReason[];
  rejectedAs?: string;
};

/**
 * Below this, we don't consider it a liquor store. Keeps a plain
 * Shoprite/Checkers/SPAR/Pick n Pay with no alcohol signal at all (score
 * 0) firmly excluded, while accepting anything with a real signal.
 */
export const LIQUOR_CONFIDENCE_THRESHOLD = 70;

const BROADER_SHOP_TYPES = new Set(['supermarket', 'convenience', 'general', 'department_store']);

const WINE_ESTATE_NAME =
  /\b(wine estate|winery|wine farm|tasting room|wine tasting|tastery|wine route|wine valley|winelands|wine lands|wine region|cellar door|vineyards?|beer estate|\w+kelder)\b/i;

const WINE_PRODUCER_NAME = /\bwines(\s+\(pty\))?(\s+ltd)?$/i;

const PRODUCER_ADDRESS =
  /\b(wine cellar|wine estate|winery|wine farm|vineyard|cellar door|klein constantia|groot constantia|laborie|overhex)\b/i;

const NON_RETAIL_NAME =
  /\b(association|salba|federation|chamber of|consultants?|soirees?|soir[eé]es?|festival|wine meander|brand owners|cork supply|packaging)\b/i;

const B2B_SUPPLY_NAME =
  /\b((liquor|wine)\s+(supply|supplier|distributors?|distribution)|wholesale liquor distributors?|sommeliers warehouse|getwine warehouse|wines direct|wine merchants?|wine works)\b/i;

const ONLINE_ONLY_NAME = /\b(online website|wine time online|wine on time)\b/i;

const NOT_A_BOTTLE_STORE_NAME = /\b(tavern|shebeen|nightclub|night club|pub|takeaway|take away|restaurant|cafe|café|deli)\b/i;

const STRONG_RETAIL_NAME =
  /\b(bottle store|bottlestore|bottle shop|liquor shop|liquorshop|drankwinkel|wine shop|wine cellar|liquor store)\b/i;

/**
 * Google (and OSM) sometimes tag the parent grocery as liquor_store.
 * A name that is only Shoprite / SPAR / Pick n Pay / Woolworths, with
 * no liquor banner, is not the bottle store — even if the type says so.
 */
const BARE_SUPERMARKET_NAME =
  /\b(shoprite|checkers|pick n pay|picknpay|woolworths|food lover|ok foods|ok grocer|ok minimarket|cambridge food|usave|superspar|kwikspar|\bspar\b|boxer|game)\b/i;

function isBareSupermarket(name?: string): boolean {
  if (!name) return false;
  if (matchesKnownBrand(name) || matchesGenericLiquorKeyword(name)) return false;
  return BARE_SUPERMARKET_NAME.test(name);
}

/**
 * Score how likely an OSM element (by its tags and name) is to be a
 * genuine liquor retailer. Multiple signals can fire independently -
 * we report all of them (useful for the debug tool) and take the
 * strongest one as the overall score, rather than summing them, so a
 * confident single signal isn't penalised for lacking others.
 *
 * Name signals inspect every useful name-like tag (name, brand,
 * official_name, alt_name, operator, …), not just the display name.
 */
export function scoreLiquorCandidate(tags: OsmTags, name?: string): LiquorScoreResult {
  const reasons: ScoreReason[] = [];

  if (isWineEstate(tags, name)) {
    return {
      score: 0,
      accepted: false,
      reasons: [{ signal: 'wine estate / tasting venue, not a bottle store', score: 0 }],
      rejectedAs: 'wine-estate',
    };
  }

  const display = name ?? tags.name ?? '';
  if (display && NON_RETAIL_NAME.test(display) && !STRONG_RETAIL_NAME.test(display) && !matchesKnownBrand(display)) {
    return {
      score: 0,
      accepted: false,
      reasons: [{ signal: 'industry body / event / non-retail — not a bottle store', score: 0 }],
      rejectedAs: 'not-retail',
    };
  }
  if (display && B2B_SUPPLY_NAME.test(display) && !STRONG_RETAIL_NAME.test(display) && !matchesKnownBrand(display)) {
    return {
      score: 0,
      accepted: false,
      reasons: [{ signal: 'supplier / distributor / B2B warehouse — not a bottle store', score: 0 }],
      rejectedAs: 'not-retail',
    };
  }
  if (display && ONLINE_ONLY_NAME.test(display) && !STRONG_RETAIL_NAME.test(display)) {
    return {
      score: 0,
      accepted: false,
      reasons: [{ signal: 'online-only listing — not a walk-in bottle store', score: 0 }],
      rejectedAs: 'not-retail',
    };
  }
  if (display && NOT_A_BOTTLE_STORE_NAME.test(display) && !STRONG_RETAIL_NAME.test(display) && !matchesKnownBrand(display)) {
    return {
      score: 0,
      accepted: false,
      reasons: [{ signal: 'tavern/pub/takeaway/restaurant — not a bottle store', score: 0 }],
      rejectedAs: 'not-retail',
    };
  }
  if (isBareSupermarket(display)) {
    return {
      score: 0,
      accepted: false,
      reasons: [{ signal: 'parent supermarket without a liquor banner', score: 0 }],
      rejectedAs: 'bare-supermarket',
    };
  }
  if (display && NOT_A_BOTTLE_STORE_NAME.test(display) && !matchesGenericLiquorKeyword(display)) {
    return {
      score: 0,
      accepted: false,
      reasons: [{ signal: 'tavern/pub/shebeen — not a bottle store', score: 0 }],
      rejectedAs: 'not-retail',
    };
  }

  // -- Layer 1: strong, explicit OSM category tags --
  if (tags.shop === 'alcohol') {
    reasons.push({ signal: 'shop=alcohol', score: 100 });
  }
  if (tags.shop === 'wine') {
    reasons.push({ signal: 'shop=wine', score: 90 });
  }
  if (tags.shop === 'beverages' && tags.alcohol === 'yes') {
    reasons.push({ signal: 'shop=beverages + alcohol=yes', score: 90 });
  }
  if (tags.alcohol === 'yes' && tags.shop && !BROADER_SHOP_TYPES.has(tags.shop) && tags.shop !== 'alcohol' && tags.shop !== 'wine' && tags.shop !== 'beverages') {
    reasons.push({ signal: `shop=${tags.shop} + alcohol=yes`, score: 90 });
  }

  // -- Layers 2+3: name-like tags --
  const fields = collectNameFields(tags);
  if (name && !fields.some((f) => f.value === name)) {
    fields.unshift({ field: 'resolved-name', value: name });
  }

  let knownBrand = false;
  for (const field of fields) {
    if (matchesKnownBrand(field.value)) {
      knownBrand = true;
      reasons.push({
        signal: `known SA liquor brand (${field.field}: ${field.value})`,
        score: 95,
      });
      break;
    }
  }
  if (!knownBrand) {
    for (const field of fields) {
      if (matchesGenericLiquorKeyword(field.value)) {
        reasons.push({
          signal: `generic liquor-related name fragment (${field.field})`,
          score: 85,
        });
        break;
      }
    }
  }

  // -- Layer 4: supermarket/convenience/general store that explicitly
  // tags alcohol sales. Lower confidence than a dedicated liquor shop.
  if (tags.alcohol === 'yes' && tags.shop && BROADER_SHOP_TYPES.has(tags.shop)) {
    reasons.push({ signal: `shop=${tags.shop} + alcohol=yes (attached counter)`, score: 75 });
  }

  const score = reasons.reduce((max, r) => Math.max(max, r.score), 0);

  if (reasons.length === 0) {
    reasons.push({ signal: 'no alcohol tag or liquor-related name match', score: 0 });
  }

  return {
    score,
    accepted: score >= LIQUOR_CONFIDENCE_THRESHOLD,
    reasons,
  };
}

function isWineEstate(tags: OsmTags, name?: string): boolean {
  if (tags.craft === 'winery' || tags.tourism === 'winery') return true;
  const display = name ?? tags.name ?? '';
  // Dedicated bottle-store / known-banner names are not producer venues,
  // even when the address sits near a cellar or the fascia says "cellar".
  if (
    matchesKnownBrand(display) ||
    STRONG_RETAIL_NAME.test(display) ||
    /fine wine cellar/i.test(display)
  ) {
    return false;
  }
  const haystack = [name, tags.name, tags.alt_name, tags.official_name, tags['addr:full'], tags['addr:street']]
    .filter(Boolean)
    .join(' ');
  if (WINE_ESTATE_NAME.test(haystack) || WINE_PRODUCER_NAME.test(haystack)) return true;
  if (PRODUCER_ADDRESS.test(haystack) && !/drankwinkel|bottle store|liquor store|liquorshop/i.test(display)) {
    return true;
  }
  return false;
}
