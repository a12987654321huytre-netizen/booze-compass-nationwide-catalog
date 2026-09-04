import type { LiquorStore } from '../types/store';
import { getDistanceMeters } from './geo';
import { CONFIG } from './config';
import { normalizeName } from './liquorMatching';

const SOURCE_PRIORITY: Record<LiquorStore['source'], number> = {
  curated: 5,
  osm: 4,
  'osm-seed': 3,
  'google-places': 3,
  cache: 2,
  'places-fallback': 1,
};

function nameSpecificity(store: LiquorStore): number {
  const n = normalizeName(store.name);
  if (!n || n === 'liquor store' || n === 'liquor shop' || n === 'bottle store') return 0;
  if (store.locationType === 'attached-counter' && store.parentName) return 3;
  if (n.includes('liquor') || n.includes('bottle') || n.includes('cellar') || n.includes('tops')) {
    return 4;
  }
  return 2;
}

function storeQuality(store: LiquorStore): number {
  return (
    nameSpecificity(store) * 100 +
    (store.matchConfidence ?? 0) +
    SOURCE_PRIORITY[store.source] * 5 +
    (store.locationType === 'standalone' ? 2 : 0)
  );
}

function namesOverlap(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const tokensA = new Set(na.split(' ').filter((t) => t.length > 2));
  const tokensB = new Set(nb.split(' ').filter((t) => t.length > 2));
  let shared = 0;
  for (const t of tokensA) if (tokensB.has(t)) shared += 1;
  const min = Math.min(tokensA.size, tokensB.size);
  return min > 0 && shared / min >= 0.6;
}

function sameCluster(a: LiquorStore, b: LiquorStore, distanceMeters: number): boolean {
  if (distanceMeters > CONFIG.dedupeDistanceMeters) return false;
  if (a.osmId && b.osmId && a.osmId === b.osmId) return true;
  if (a.googlePlaceId && b.googlePlaceId && a.googlePlaceId === b.googlePlaceId) return true;
  if (a.parentName && b.parentName && normalizeName(a.parentName) === normalizeName(b.parentName)) {
    return true;
  }
  if (a.brand && b.brand && normalizeName(a.brand) === normalizeName(b.brand)) return true;
  if (namesOverlap(a.name, b.name)) return true;
  // Very close unnamed/generic pair
  if (distanceMeters < 25) return true;
  return false;
}

function pickWinner(a: LiquorStore, b: LiquorStore): LiquorStore {
  const qa = storeQuality(a);
  const qb = storeQuality(b);
  if (qa !== qb) return qa > qb ? a : b;
  // Merge useful extras from the loser onto the winner.
  const winner = qa >= qb ? a : b;
  const loser = winner === a ? b : a;
  const alternativeNames = unique([
    ...(winner.alternativeNames ?? []),
    loser.name,
    ...(loser.alternativeNames ?? []),
  ]);
  return {
    ...winner,
    alternativeNames,
    openingHours: winner.openingHours || loser.openingHours,
    address: winner.address || loser.address,
    osmId: winner.osmId || loser.osmId,
    googlePlaceId: winner.googlePlaceId || loser.googlePlaceId,
    parentName: winner.parentName || loser.parentName,
    brand: winner.brand || loser.brand,
    phone: winner.phone || loser.phone,
    website: winner.website || loser.website,
    province: winner.province || loser.province,
    city: winner.city || loser.city,
  };
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

/**
 * Collapse multiple representations of the same physical destination
 * (Woolworths / Woolworths Cellar / Liquor store at the same door) into
 * one POI, keeping the most specific liquor identity.
 *
 * Ranking for the compass is still nearest-first after distances are
 * applied by the hook — this function only dedupes and prefers identity.
 */
export function dedupeStores(stores: LiquorStore[]): LiquorStore[] {
  const kept: LiquorStore[] = [];

  for (const store of stores) {
    let merged = false;
    for (let i = 0; i < kept.length; i++) {
      const existing = kept[i];
      const distance = getDistanceMeters(
        store.latitude,
        store.longitude,
        existing.latitude,
        existing.longitude
      );
      if (sameCluster(store, existing, distance)) {
        kept[i] = pickWinner(existing, store);
        merged = true;
        break;
      }
    }
    if (!merged) kept.push(store);
  }

  return kept;
}

/** Nearest first. Distance must already be populated. */
export function rankStores(stores: LiquorStore[]): LiquorStore[] {
  return [...stores].sort((a, b) => {
    const da = a.distanceMeters ?? Infinity;
    const db = b.distanceMeters ?? Infinity;
    if (da !== db) return da - db;
    return storeQuality(b) - storeQuality(a);
  });
}
