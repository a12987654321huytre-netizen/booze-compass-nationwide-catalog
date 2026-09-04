/**
 * Physical-location matching between a provider observation and the
 * existing Booze Compass catalog.
 *
 * A shared brand/name is NOT enough. Village Liquors in Cape Town,
 * Stellenbosch and Johannesburg are three POIs until coordinates (and
 * other signals) say otherwise.
 *
 * False-positive merging is worse than retaining a possible duplicate.
 * Uncertain identities stay as review candidates — they are not added
 * as new POIs and they do not overwrite existing ones.
 */

import { getDistanceMeters } from './geo';
import { matchesKnownBrand, normalizeName } from './liquorMatching';

export const MATCH_CLASSES = [
  'MATCH_CONFIRMED',
  'MATCH_LIKELY',
  'POSSIBLE_MATCH',
  'NEW_POI',
] as const;

export type MatchClass = (typeof MATCH_CLASSES)[number];

export type MatchablePoi = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  phone?: string;
  website?: string;
  brand?: string;
  googlePlaceId?: string;
  osmId?: string;
  city?: string;
};

export type MatchEvidence = {
  distanceMeters: number;
  nameSimilarity: number;
  samePlaceId: boolean;
  phoneMatch: boolean;
  brandMatch: boolean;
  addressOverlap: boolean;
};

export type MatchResult = {
  class: MatchClass;
  existing?: MatchablePoi;
  evidence?: MatchEvidence;
  reasons: string[];
};

const CONFIRMED_DISTANCE_M = 80;
const LIKELY_DISTANCE_M = 160;
const POSSIBLE_DISTANCE_M = 280;
/** Beyond this, even an identical name is a different physical location. */
const SAME_PLACE_MAX_M = 400;

function tokens(value: string): Set<string> {
  return new Set(
    normalizeName(value)
      .split(' ')
      .filter((token) => token.length > 2)
  );
}

export function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) {
    const shorter = Math.min(na.length, nb.length);
    if (shorter >= 5) return 0.86;
  }
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const token of ta) if (tb.has(token)) shared += 1;
  const union = new Set([...ta, ...tb]).size;
  return union === 0 ? 0 : shared / union;
}

export function phonesMatch(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const da = a.replace(/\D/g, '');
  const db = b.replace(/\D/g, '');
  if (da.length < 7 || db.length < 7) return false;
  const sa = da.slice(-9);
  const sb = db.slice(-9);
  return sa === sb;
}

function knownBrandName(name: string, brand?: string): string | undefined {
  const haystack = `${brand ?? ''} ${name}`;
  if (!matchesKnownBrand(haystack) && !matchesKnownBrand(name)) return undefined;
  return normalizeName(brand || name);
}

function brandsMatch(a: MatchablePoi, b: MatchablePoi): boolean {
  const ba = knownBrandName(a.name, a.brand);
  const bb = knownBrandName(b.name, b.brand);
  if (!ba || !bb) return false;
  return ba.includes(bb) || bb.includes(ba) || nameSimilarity(ba, bb) >= 0.72;
}

function addressOverlap(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return false;
  let shared = 0;
  for (const token of ta) if (tb.has(token)) shared += 1;
  const min = Math.min(ta.size, tb.size);
  return min > 0 && shared / min >= 0.5;
}

function classify(evidence: MatchEvidence): { class: MatchClass; reasons: string[] } {
  const reasons: string[] = [];
  if (evidence.samePlaceId) {
    reasons.push('same Google Place ID');
    return { class: 'MATCH_CONFIRMED', reasons };
  }

  const { distanceMeters: d, nameSimilarity: sim } = evidence;
  if (d > SAME_PLACE_MAX_M) {
    reasons.push(`too far (${Math.round(d)}m) to be the same physical location`);
    return { class: 'NEW_POI', reasons };
  }

  if (evidence.phoneMatch && d <= 200) {
    reasons.push('phone + proximity');
    return { class: 'MATCH_CONFIRMED', reasons };
  }
  if (d <= 50 && sim >= 0.55) {
    reasons.push('very close with overlapping name');
    return { class: 'MATCH_CONFIRMED', reasons };
  }
  if (d <= CONFIRMED_DISTANCE_M && sim >= 0.82) {
    reasons.push('close + strong name match');
    return { class: 'MATCH_CONFIRMED', reasons };
  }
  if (d <= CONFIRMED_DISTANCE_M && evidence.brandMatch && sim >= 0.45) {
    reasons.push('close + same brand');
    return { class: 'MATCH_CONFIRMED', reasons };
  }
  if (d <= 100 && evidence.addressOverlap && sim >= 0.6) {
    reasons.push('address overlap + name');
    return { class: 'MATCH_CONFIRMED', reasons };
  }

  if (d <= LIKELY_DISTANCE_M && sim >= 0.7) {
    reasons.push('nearby + similar name');
    return { class: 'MATCH_LIKELY', reasons };
  }
  if (d <= 120 && evidence.brandMatch) {
    reasons.push('nearby + same brand, name not identical');
    return { class: 'MATCH_LIKELY', reasons };
  }

  if (d <= POSSIBLE_DISTANCE_M && sim >= 0.45) {
    reasons.push('possible same place — not confident enough to merge or add');
    return { class: 'POSSIBLE_MATCH', reasons };
  }

  reasons.push('no confident physical-location match');
  return { class: 'NEW_POI', reasons };
}

const CLASS_RANK: Record<MatchClass, number> = {
  MATCH_CONFIRMED: 3,
  MATCH_LIKELY: 2,
  POSSIBLE_MATCH: 1,
  NEW_POI: 0,
};

export function matchObservation(
  observation: MatchablePoi,
  existing: readonly MatchablePoi[]
): MatchResult {
  if (observation.googlePlaceId) {
    const byPlaceId = existing.find(
      (poi) => poi.googlePlaceId && poi.googlePlaceId === observation.googlePlaceId
    );
    if (byPlaceId) {
      return {
        class: 'MATCH_CONFIRMED',
        existing: byPlaceId,
        evidence: {
          distanceMeters: getDistanceMeters(
            observation.latitude,
            observation.longitude,
            byPlaceId.latitude,
            byPlaceId.longitude
          ),
          nameSimilarity: nameSimilarity(observation.name, byPlaceId.name),
          samePlaceId: true,
          phoneMatch: phonesMatch(observation.phone, byPlaceId.phone),
          brandMatch: brandsMatch(observation, byPlaceId),
          addressOverlap: addressOverlap(observation.address, byPlaceId.address),
        },
        reasons: ['same Google Place ID'],
      };
    }
  }

  let best: MatchResult = { class: 'NEW_POI', reasons: ['no nearby catalog POI with overlapping identity'] };

  for (const poi of existing) {
    const distanceMeters = getDistanceMeters(
      observation.latitude,
      observation.longitude,
      poi.latitude,
      poi.longitude
    );
    if (distanceMeters > 2000) continue;

    const evidence: MatchEvidence = {
      distanceMeters,
      nameSimilarity: nameSimilarity(observation.name, poi.name),
      samePlaceId: false,
      phoneMatch: phonesMatch(observation.phone, poi.phone),
      brandMatch: brandsMatch(observation, poi),
      addressOverlap: addressOverlap(observation.address, poi.address),
    };
    const classified = classify(evidence);
    const candidate: MatchResult = {
      class: classified.class,
      existing: poi,
      evidence,
      reasons: classified.reasons,
    };

    if (CLASS_RANK[candidate.class] > CLASS_RANK[best.class]) {
      best = candidate;
    } else if (
      candidate.class === best.class &&
      candidate.class !== 'NEW_POI' &&
      (candidate.evidence?.distanceMeters ?? Infinity) < (best.evidence?.distanceMeters ?? Infinity)
    ) {
      best = candidate;
    }
  }

  return best;
}

/** Only NEW_POI observations may be inserted as additional catalog records. */
export function shouldAddAsNewPoi(result: MatchResult): boolean {
  return result.class === 'NEW_POI';
}

export function shouldEnrichExisting(result: MatchResult): boolean {
  return result.class === 'MATCH_CONFIRMED';
}
