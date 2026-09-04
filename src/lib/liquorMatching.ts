/**
 * South African liquor-store brand and name-fragment recognition.
 *
 * OSM tagging for SA liquor retail is inconsistent - a real bottle store
 * (e.g. "Liquor King" next to a Shoprite) can easily be untagged,
 * mis-tagged as a generic convenience store, or missing entirely from
 * the "obvious" shop=alcohol/wine/beverages set. This module lets us
 * recognise a likely liquor store from its *name* as a second signal,
 * on top of (never instead of) OSM tags.
 */

/**
 * Normalise a business name for matching: lowercase, expand "&" to
 * "and", strip accents/punctuation, collapse whitespace. This makes
 * "PicardiRebel", "Picardi Rebel", "PICARDI REBEL" and "Picardi-Rebel"
 * all compare equal.
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Known South African liquor-retail banners and chains, normalised.
 * Matched as a substring of the normalised business name, so
 * "Liquor King Khayamandi" or "Overland Liquors / Liquor King" both
 * match "liquor king".
 *
 * Deliberately includes common misspellings/spacing variants (e.g. both
 * "picardi rebel" and "picardirebel") since real OSM data contains both.
 *
 * Bare "tops" and "ngf" were in an earlier list and caused false
 * positives (any shop whose name contains "tops"). They are gone.
 */
export const KNOWN_SA_LIQUOR_BRANDS: readonly string[] = [
  'tops at spar',
  'spar tops',
  'tops spar',
  'checkers liquorshop',
  'checkers liquor shop',
  'checkers liquor',
  'liquorshop checkers',
  'shoprite liquorshop',
  'shoprite liquor shop',
  'shoprite liquor',
  'liquorshop shoprite',
  'market liquors',
  'market liquor',
  'food lovers market liquor',
  "food lover's market liquor",
  'foodlovers market liquor',
  'pick n pay liquor',
  'picknpay liquor',
  'pnp liquor',
  'boxer liquor',
  'ok liquor',
  'liquor city',
  'liquor king',
  'liquor kings',
  'liquorking',
  'king liquor',
  'kings liquor',
  "king's liquor",
  'the liquor boys',
  'liquor boys',
  'ultra liquors express',
  'ultra liquors',
  'liberty liquors',
  'picardi rebel',
  'picardirebel',
  'blue bottle liquors xl',
  'blue bottle liquors express',
  'blue bottle liquors platinum',
  'blue bottle platinum',
  'blue bottle express',
  'blue bottle liquors',
  'blue bottle liquor',
  'liquors express',
  'liquor express',
  "big daddy's liquors",
  'big daddys liquors',
  'big daddy liquors',
  "diamond's discount liquor",
  'diamonds discount liquor',
  'diamond discount liquor',
  'norman goodfellows',
  'whiskybrother',
  'whisky brother',
  'whisky emporium',
  "monty's liquor boutique",
  'montys liquor boutique',
  'grapevine blue bottle liquors',
  'grapevine liquors',
  'solly kramers',
  'tabooz',
  'liquor land',
  'liquorland',
  'loco liquor',
  'liquor legends',
  'model bottle store',
  'monument liquor warehouse',
  'wine and liquor',
  'western province cellars',
  'village liquors',
  'village liquor',
  'woolworths cellar',
  'w cellar',
  'game liquor',
  'parade liquors',
  'observatory bottle store',
  'woodstock liquors',
  'aroma liquors',
  'aroma liquor',
  'caroline s fine wine cellar',
  'ma booze',
  'mabooze',
  'house of liquor',
  'house of liquors',
] as const;

/**
 * Generic name fragments that suggest a liquor retailer even when the
 * business isn't one of the known banners above. Lower confidence than
 * a known-brand match, but still a strong signal - virtually nothing
 * that isn't a liquor retailer puts "bottle store" or "drankwinkel" in
 * its name.
 *
 * "kelders" (cellars) is deliberately excluded on its own - it's too
 * generic and collides with unrelated place names (e.g. the town "De
 * Kelders"). "wynkelders" (wine cellars) is specific enough to keep.
 */
export const GENERIC_LIQUOR_NAME_FRAGMENTS: readonly string[] = [
  'liquor shop',
  'liquorshop',
  'liquor store',
  'liquor mart',
  'liquor warehouse',
  'discount liquor',
  'wholesale liquor',
  'bottle store',
  'bottlestore',
  'bottle shop',
  'wine and spirits',
  'wines and spirits',
  'wine and liquor',
  'drankwinkel',
  'drank winkel',
  'wynwinkel',
  'wyn and drank',
  'wynkelders',
  'fine wine cellar',
  'wine cellar',
  // Bare "liquor"/"liquors" last and least specific of this tier, but
  // still reliably alcohol-related as a business-name fragment.
  'liquors',
  'liquor',
] as const;

/**
 * Display names that are too generic to be a useful commercial identity.
 * If OSM has one of these as `name` and a real brand as `brand`, we
 * show the brand.
 */
export const GENERIC_DISPLAY_NAMES: readonly string[] = [
  'liquor store',
  'liquor shop',
  'liquorshop',
  'bottle store',
  'bottle shop',
  'bottlestore',
  'drankwinkel',
  'wine shop',
  'wine store',
  'alcohol',
  'off licence',
  'off license',
  'off-licence',
  'cellar',
  'wine cellar',
  'liquor',
  'liquors',
  'tops',
  'tops!',
  'shop',
  'store',
];

function containsFragment(normalized: string, fragment: string): boolean {
  if (fragment.length <= 3) {
    // Tiny tokens must be whole words so "ngf" doesn't match "something".
    return new RegExp(`(?:^|\\s)${fragment}(?:\\s|$)`).test(normalized);
  }
  return normalized.includes(fragment);
}

/** True if the name matches a known SA liquor-retail banner/chain. */
export function matchesKnownBrand(name: string): boolean {
  const normalized = normalizeName(name);
  if (!normalized) return false;
  return KNOWN_SA_LIQUOR_BRANDS.some((brand) => containsFragment(normalized, brand));
}

/** True if the name contains a generic liquor-retail keyword/phrase. */
export function matchesGenericLiquorKeyword(name: string): boolean {
  const normalized = normalizeName(name);
  if (!normalized) return false;
  return GENERIC_LIQUOR_NAME_FRAGMENTS.some((fragment) =>
    containsFragment(normalized, fragment)
  );
}

export function isGenericDisplayName(name: string): boolean {
  const normalized = normalizeName(name);
  if (!normalized) return true;
  return GENERIC_DISPLAY_NAMES.includes(normalized);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a single Overpass-compatible regex (PCRE-ish, case handled via
 * the ",i" flag in the query itself) that matches any of the known
 * brands or generic keywords in a name-like tag. Used to ask Overpass
 * directly for "anything nearby whose name looks like a liquor store",
 * regardless of its shop/amenity tag.
 *
 * Short, ambiguous tokens ("tops" alone, "cellar" alone) are excluded
 * from the server-side regex so we don't scan half the map. The
 * classifier can still accept them locally when other tags confirm.
 */
export function buildLiquorNameRegex(): string {
  const skip = new Set(['liquor', 'liquors', 'cellar', 'wine cellar']);
  const allFragments = [...KNOWN_SA_LIQUOR_BRANDS, ...GENERIC_LIQUOR_NAME_FRAGMENTS].filter(
    (fragment) => fragment.length >= 5 && !skip.has(fragment)
  );
  const unique = Array.from(new Set(allFragments)).sort((a, b) => b.length - a.length);
  return unique.map((fragment) => escapeRegExp(fragment).replace(/\\ /g, '[ -]?')).join('|');
}
