import type { LiquorLocationType } from '../types/store';
import type { OsmTags } from './osmFormat';
import { collectNameFields } from './osmFormat';
import {
  isGenericDisplayName,
  matchesGenericLiquorKeyword,
  matchesKnownBrand,
  normalizeName,
} from './liquorMatching';

export type IdentityResult = {
  name: string;
  locationType: LiquorLocationType;
  parentName?: string;
  brand?: string;
  alternativeNames: string[];
  identitySource: string;
};

type ParentMapping = {
  /** Matches a parent supermarket / grocery identity. */
  parentPattern: RegExp;
  parentName: string;
  liquorName: string;
};

/**
 * Parent businesses whose liquor operation is a distinct commercial
 * identity. We only apply the liquor name when the candidate has
 * already been classified as a liquor outlet — never as a way to turn
 * every Woolworths into Woolworths Cellar.
 */
const PARENT_LIQUOR_BRANDS: ParentMapping[] = [
  { parentPattern: /\bwoolworths?\b/i, parentName: 'Woolworths', liquorName: 'Woolworths Cellar' },
  {
    parentPattern: /food lover/,
    parentName: "Food Lover's Market",
    liquorName: 'Market Liquor',
  },
  { parentPattern: /\bcheckers\b/i, parentName: 'Checkers', liquorName: 'Checkers LiquorShop' },
  { parentPattern: /\bshoprite\b/i, parentName: 'Shoprite', liquorName: 'Shoprite LiquorShop' },
  {
    parentPattern: /\bpick n pay\b/i,
    parentName: 'Pick n Pay',
    liquorName: 'Pick n Pay Liquor',
  },
  { parentPattern: /\bspar\b/i, parentName: 'SPAR', liquorName: 'TOPS at SPAR' },
];

const ATTACHED_SHOP_TYPES = new Set(['supermarket', 'convenience', 'general', 'department_store']);

const FIELD_PRIORITY: Record<string, number> = {
  name: 6,
  official_name: 5,
  brand: 4,
  alt_name: 3,
  'name:en': 2,
  short_name: 1,
  operator: 0,
  ref: -1,
  'resolved-name': 6,
  curated: 10,
};

function usefulness(value: string, field: string): number {
  const normalized = normalizeName(value);
  if (!normalized) return -1;
  if (isGenericDisplayName(value)) return 1;
  if (isParentOnlyName(value)) return 2;
  if (matchesKnownBrand(value) || matchesGenericLiquorKeyword(value)) return 5;
  // operator of a parent supermarket is almost never the liquor identity
  if (field === 'operator' && isParentOnlyName(value)) return 0;
  if (field === 'ref') return 1;
  return 4; // a specific commercial name we don't otherwise recognise
}

function isParentOnlyName(value: string): boolean {
  const normalized = normalizeName(value);
  for (const mapping of PARENT_LIQUOR_BRANDS) {
    if (mapping.parentPattern.test(value) || mapping.parentPattern.test(normalized)) {
      // "Woolworths Cellar" / "Checkers LiquorShop" are liquor identities,
      // not parent-only.
      if (matchesKnownBrand(value) || matchesGenericLiquorKeyword(value)) return false;
      // Exact-ish parent: "Woolworths", "Woolworths Food", "SPAR Die Boord"
      const liquorBits = /liquor|cellar|tops|bottle|drank/i.test(value);
      return !liquorBits;
    }
  }
  return false;
}

function applyParentLiquorName(value: string): { name: string; parentName: string } | null {
  for (const mapping of PARENT_LIQUOR_BRANDS) {
    if (mapping.parentPattern.test(value) || mapping.parentPattern.test(normalizeName(value))) {
      if (matchesKnownBrand(value) || matchesGenericLiquorKeyword(value)) return null;
      const liquorBits = /liquor|cellar|tops|bottle|drank/i.test(value);
      if (liquorBits) return null;
      return { name: mapping.liquorName, parentName: mapping.parentName };
    }
  }
  return null;
}

function expandAbbreviations(value: string): string | null {
  const normalized = normalizeName(value);
  if (normalized === 'w cellar' || normalized === 'wcellar') return 'Woolworths Cellar';
  if (normalized === 'tops' || normalized === 'tops!') return null; // handled via brand
  return null;
}

/**
 * Pick the commercial identity a human would actually look for on a sign.
 *
 * Hierarchy of intent:
 * 1. Curated name wins when we already know the real identity.
 * 2. Prefer a specific liquor name over a generic "Liquor store".
 * 3. Prefer a liquor-outlet identity over a parent supermarket name.
 * 4. Never promote operator=Woolworths into "Woolworths Cellar" unless
 *    the candidate is already classified as a liquor outlet.
 * 5. Fall back to "Liquor store" only when nothing usable exists.
 */
export function resolveStoreIdentity(
  tags: OsmTags,
  options?: {
    classifiedAsLiquor?: boolean;
    curatedName?: string;
    curatedType?: LiquorLocationType;
    curatedParentName?: string;
  }
): IdentityResult {
  if (options?.curatedName) {
    const alternatives = collectNameFields(tags).map((f) => f.value);
    return {
      name: options.curatedName,
      locationType: options.curatedType ?? inferLocationType(tags, options.curatedName),
      parentName: options.curatedParentName,
      brand: tags.brand?.trim() || undefined,
      alternativeNames: unique([options.curatedName, ...alternatives]),
      identitySource: 'curated',
    };
  }

  const fields = collectNameFields(tags);
  const alternatives = fields.map((f) => f.value);

  if (fields.length === 0) {
    return {
      name: 'Liquor store',
      locationType: inferLocationType(tags, 'Liquor store'),
      alternativeNames: [],
      identitySource: 'fallback',
    };
  }

  let best = fields[0];
  let bestScore = -Infinity;
  for (const field of fields) {
    const score = usefulness(field.value, field.field) * 10 + (FIELD_PRIORITY[field.field] ?? 0);
    if (score > bestScore) {
      best = field;
      bestScore = score;
    }
  }

  let name = best.value;
  let identitySource = best.field;
  let parentName: string | undefined;

  const expanded = expandAbbreviations(name);
  if (expanded) {
    name = expanded;
    identitySource = `${best.field}→abbreviation`;
    parentName = 'Woolworths';
  }

  // Generic "Liquor Store" + brand "Village Liquors" → Village Liquors.
  if (isGenericDisplayName(name)) {
    const specific = fields.find(
      (f) => f.field !== best.field && !isGenericDisplayName(f.value) && !isParentOnlyName(f.value)
    );
    if (specific) {
      name = specific.value;
      identitySource = `${specific.field} (preferred over generic ${best.field})`;
    }
  }

  // "Tops" + brand "Tops at Spar" → Tops at SPAR.
  if (normalizeName(name) === 'tops' || name === 'Tops!') {
    const brand = fields.find((f) => /tops at spar|tops @ spar/i.test(f.value));
    if (brand) {
      name = brand.value;
      identitySource = `${brand.field} (preferred over short ${best.field})`;
    } else {
      name = 'TOPS at SPAR';
      identitySource = `${best.field}→tops-brand`;
      parentName = 'SPAR';
    }
  }

  // Classified as liquor, but the surviving name is the parent supermarket.
  // Only then do we rewrite Woolworths → Woolworths Cellar.
  if (options?.classifiedAsLiquor !== false) {
    const mapped = applyParentLiquorName(name);
    if (mapped) {
      parentName = mapped.parentName;
      name = mapped.name;
      identitySource = `${best.field}→parent-liquor-banner`;
    }
  }

  // "LiquorShop Checkers" is already a liquor identity — keep it, don't
  // rewrite via brand=Checkers.
  const locationType = inferLocationType(tags, name, parentName);

  if (locationType === 'attached-counter' && !parentName) {
    parentName = inferParentFromTags(tags);
  }

  return {
    name,
    locationType,
    parentName,
    brand: tags.brand?.trim() || undefined,
    alternativeNames: unique(alternatives),
    identitySource,
  };
}

function inferLocationType(
  tags: OsmTags,
  name: string,
  parentName?: string
): LiquorLocationType {
  if (parentName) return 'attached-counter';
  if (tags.shop && ATTACHED_SHOP_TYPES.has(tags.shop)) return 'attached-counter';
  if (applyParentLiquorName(name) || applyParentLiquorName(tags.name ?? '')) {
    return 'attached-counter';
  }
  const normalized = normalizeName(name);
  if (
    /woolworths cellar|market liquor|checkers liquorshop|shoprite liquorshop|pick n pay liquor|tops at spar/.test(
      normalized
    )
  ) {
    return 'attached-counter';
  }
  return 'standalone';
}

function inferParentFromTags(tags: OsmTags): string | undefined {
  const hay = [tags.brand, tags.operator, tags.name].filter(Boolean).join(' ');
  for (const mapping of PARENT_LIQUOR_BRANDS) {
    if (mapping.parentPattern.test(hay)) return mapping.parentName;
  }
  return undefined;
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value.trim());
  }
  return out;
}

/**
 * True when a supermarket/parent name has no liquor identity of its own.
 * Used by tests and debug to show we did NOT promote the grocery store.
 */
export function isParentBusinessName(name: string): boolean {
  return isParentOnlyName(name);
}
