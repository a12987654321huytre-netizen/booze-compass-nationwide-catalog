import type { DiscoveredCandidate } from '../types/store';
import { getDistanceMeters } from './geo';
import { scoreLiquorCandidate } from './liquorScoring';
import {
  CURATED_ADDITIONS,
  CURATED_EXCLUSIONS,
  CURATED_RENAMES,
  type CuratedExclusion,
  type CuratedRename,
} from '../data/curatedPois';
import { normalizeName } from './liquorMatching';

/**
 * Layer of our own intelligence. Tiny on purpose. Used to fill known
 * OSM holes (Woolworths Cellar, Market Liquor) and to rename/exclude
 * specific bad records — not to catalogue the country.
 */
export function findCuratedCandidates(
  latitude: number,
  longitude: number,
  radiusMeters: number
): DiscoveredCandidate[] {
  const out: DiscoveredCandidate[] = [];
  for (const poi of CURATED_ADDITIONS) {
    const distance = getDistanceMeters(latitude, longitude, poi.latitude, poi.longitude);
    if (distance > radiusMeters) continue;
    const tags = {
      name: poi.name,
      ...(poi.parentName ? { operator: poi.parentName } : {}),
      shop: poi.type === 'attached-counter' ? 'supermarket' : 'alcohol',
      alcohol: 'yes',
      ...(poi.openingHours ? { opening_hours: poi.openingHours } : {}),
    };
    out.push({
      id: poi.id,
      latitude: poi.latitude,
      longitude: poi.longitude,
      rawTags: tags,
      score: scoreLiquorCandidate(tags, poi.name),
      source: 'curated',
      curatedName: poi.name,
      curatedType: poi.type,
      curatedParentName: poi.parentName,
    });
  }
  return out;
}

export function isExcluded(candidate: {
  osmId?: string;
  latitude: number;
  longitude: number;
  rawTags: { name?: string };
}): CuratedExclusion | null {
  for (const rule of CURATED_EXCLUSIONS) {
    if (rule.osmId && candidate.osmId && rule.osmId === candidate.osmId) return rule;
    const name = candidate.rawTags.name ?? '';
    if (normalizeName(name) !== normalizeName(rule.matchName)) continue;
    if (rule.latitude == null || rule.longitude == null) return rule;
    const distance = getDistanceMeters(
      candidate.latitude,
      candidate.longitude,
      rule.latitude,
      rule.longitude
    );
    if (distance <= (rule.radiusMeters ?? 80)) return rule;
  }
  return null;
}

export function findRename(candidate: {
  osmId?: string;
  latitude: number;
  longitude: number;
  rawTags: { name?: string };
}): CuratedRename | null {
  for (const rule of CURATED_RENAMES) {
    const name = candidate.rawTags.name ?? '';
    if (normalizeName(name) !== normalizeName(rule.matchName)) continue;
    const distance = getDistanceMeters(
      candidate.latitude,
      candidate.longitude,
      rule.latitude,
      rule.longitude
    );
    if (distance <= (rule.radiusMeters ?? 80)) return rule;
  }
  return null;
}
