/**
 * Western Cape Liquor Authority (WCLA) valid-licence enrichment.
 *
 * The published register lists licence holder + premises — not always
 * the fascia on the building. Booze Compass is a bottle-store locator,
 * not an "anywhere alcohol can be purchased" map.
 *
 * Rules:
 * - Match/enrich existing Booze Compass stores. Never rename or replace them.
 * - Personal licence-holder names never become map-facing store names.
 * - New pins only for independently verified public names with coordinates.
 * - Absence from the register never deletes an existing catalog POI.
 * - Generic supermarket licences (SPAR, Checkers, Shoprite, Pick n Pay,
 *   Woolworths) are not compass destinations; TOPS / LiquorShop / PnP Liquor
 *   counterparts are.
 */

import { isSafePublicStoreName, looksLikePersonName } from './eclb';

export type WclaHolderType = 'person' | 'company' | 'store_brand' | 'unclear';

export type WclaMatchClass =
  | 'MATCH_CONFIRMED'
  | 'MATCH_LIKELY'
  | 'POSSIBLE_MATCH'
  | 'NEW_POI'
  | 'REVIEW_REQUIRED'
  | 'REJECTED_FOR_COMPASS';

export type WclaEnrichmentRow = {
  existingId: string;
  wclaLicenceNo: string;
  wclaLicenceHolder: string;
  wclaHolderType: WclaHolderType | string;
  wclaLicenceType?: string;
  address?: string | null;
  premisesName?: string;
  suburb?: string;
  pdfPage?: string;
  matchClass?: WclaMatchClass | string;
};

export type WclaEnrichmentFile = {
  version: number;
  generatedFrom: string;
  rule: string;
  enrichment: WclaEnrichmentRow[];
};

export type WclaNewPoi = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  province: 'Western Cape';
  brand?: string;
  locationType: 'standalone' | 'attached-counter';
  parentName?: string;
  source: 'wcla';
  wclaLicenceNo: string;
  wclaLicenceHolder: string;
  wclaHolderType: WclaHolderType | string;
  wclaLicenceType?: string;
  wclaPdfPage?: string;
  publicNameSource: string;
  geocodePrecision: 'building' | 'street' | 'locality';
  notes?: string;
};

export type WclaNewPoiFile = {
  version: number;
  rule: string;
  source?: string;
  sourceDate?: string;
  pois: WclaNewPoi[];
};

export function publicWclaDisplayName(input: {
  holderType: string;
  licenceHolder: string;
  premisesName?: string;
  town?: string;
}): string {
  const premises = input.premisesName?.trim();
  if (premises && isSafePublicStoreName(premises)) {
    return premises;
  }
  if (input.holderType === 'person' || looksLikePersonName(input.licenceHolder)) {
    const town = input.town?.trim() || 'Western Cape';
    return `Bottle store, ${town}`;
  }
  const holder = input.licenceHolder.trim();
  if (holder && isSafePublicStoreName(holder)) {
    return holder;
  }
  const town = input.town?.trim() || 'Western Cape';
  return `Bottle store, ${town}`;
}

export { isSafePublicStoreName, looksLikePersonName };
