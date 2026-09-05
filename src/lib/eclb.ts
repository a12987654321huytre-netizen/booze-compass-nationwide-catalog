/**
 * Eastern Cape Liquor Board (ECLB) 2025–2026 off-consumption enrichment.
 *
 * The published register lists the *registered person* (licence holder) and
 * the licensed premises — not the fascia on the building. Form 18 has a
 * separate BUSINESS NAME field that was never published.
 *
 * Rules:
 * - Match/enrich existing Booze Compass stores. Never rename or replace them.
 * - Personal licence-holder names never become map-facing store names.
 * - New pins only for independently verified public names with coordinates.
 * - Absence from the register never deletes an existing catalog POI.
 */

export type EclbHolderType = 'person' | 'company' | 'store_brand' | 'unclear';

export type EclbMatchClass =
  | 'MATCH_CONFIRMED'
  | 'MATCH_LIKELY'
  | 'POSSIBLE_MATCH'
  | 'unmatched';

export type EclbEnrichmentRow = {
  existingId: string;
  eclbId: number;
  eclbRegNo: string;
  eclbLicenceHolder: string;
  eclbHolderType: EclbHolderType | string;
  address?: string | null;
  matchClass?: EclbMatchClass | string;
};

export type EclbEnrichmentFile = {
  version: number;
  generatedFrom: string;
  rule: string;
  enrichment: EclbEnrichmentRow[];
};

export type EclbNewPoi = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  province: 'Eastern Cape';
  brand?: string;
  locationType: 'standalone' | 'attached-counter';
  parentName?: string;
  source: 'eclb';
  eclbId: number;
  eclbRegNo?: string;
  eclbLicenceHolder: string;
  eclbHolderType: EclbHolderType | string;
  publicNameSource: string;
  geocodePrecision: 'building' | 'street' | 'locality';
  notes?: string;
};

export type EclbNewPoiFile = {
  version: number;
  rule: string;
  pois: EclbNewPoi[];
};

const PERSON_LIKE =
  /^(off-sales liquor store)/i;

/**
 * Map-facing name for an unmatched ECLB row. Personal names are never used.
 * Independently verified trading names (passed in) win; otherwise a generic
 * premises label.
 */
export function publicEclbDisplayName(input: {
  holderType: string;
  licenceHolder: string;
  town?: string;
  verifiedTradingName?: string;
}): string {
  if (input.verifiedTradingName?.trim()) {
    return input.verifiedTradingName.trim();
  }
  if (input.holderType === 'person' || input.holderType === 'unclear') {
    const town = input.town?.trim() || 'Eastern Cape';
    return `Off-sales liquor store, ${town}`;
  }
  const holder = input.licenceHolder.trim();
  if (input.holderType === 'store_brand' && holder && !looksLikePersonName(holder)) {
    return holder;
  }
  const town = input.town?.trim() || 'Eastern Cape';
  return `Off-sales liquor store, ${town}`;
}

export function looksLikePersonName(value: string): boolean {
  const t = value.trim();
  if (!t) return false;
  if (/\b(pty|ltd|limited|cc|trust|liquor|liquors|liqour|bottle|cellar|booze|drankwinkel|sales|spar|boxer|shoprite|checkers|woolworths|tops|takeaway|off-sales)\b/i.test(t)) {
    return false;
  }
  const parts = t.split(/\s+/);
  return parts.length >= 2 && parts.length <= 4 && parts.every((p) => /^[A-Z][a-z]+(?:'[A-Za-z]+)?$/.test(p) || /^[A-Z]\.$/.test(p));
}

export function isSafePublicStoreName(name: string): boolean {
  if (!name.trim()) return false;
  if (PERSON_LIKE.test(name)) return true;
  return !looksLikePersonName(name);
}
