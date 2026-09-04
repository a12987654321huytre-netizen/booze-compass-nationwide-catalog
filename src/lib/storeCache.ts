import type { LiquorStore } from '../types/store';
import { CONFIG } from './config';
import { encodeGeohash, tilesForPoint } from './geohash';

export type TileEntry = {
  geohash: string;
  fetchedAt: number;
  lastAccess: number;
  stores: LiquorStore[];
};

type CacheFile = {
  version: 2;
  tiles: Record<string, TileEntry>;
};

const EMPTY: CacheFile = { version: 2, tiles: {} };

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

function readFile(): CacheFile {
  if (!canUseStorage()) return EMPTY;
  try {
    const raw = localStorage.getItem(CONFIG.cacheStorageKey);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as CacheFile;
    if (!parsed || parsed.version !== 2 || !parsed.tiles) return EMPTY;
    return parsed;
  } catch {
    return EMPTY;
  }
}

function writeFile(file: CacheFile): void {
  if (!canUseStorage()) return;
  try {
    const hashes = Object.keys(file.tiles);
    if (hashes.length > CONFIG.cacheMaxTiles) {
      const sorted = hashes.sort(
        (a, b) => (file.tiles[a].lastAccess ?? 0) - (file.tiles[b].lastAccess ?? 0)
      );
      const drop = sorted.slice(0, hashes.length - CONFIG.cacheMaxTiles);
      for (const key of drop) delete file.tiles[key];
    }
    localStorage.setItem(CONFIG.cacheStorageKey, JSON.stringify(file));
  } catch {
    // Storage full or unavailable - non-fatal.
  }
}

function stripVolatile(store: LiquorStore): LiquorStore {
  const { distanceMeters: _d, bearingDegrees: _b, ...rest } = store;
  return rest;
}

/** All cached stores covering the neighbourhood of a point. */
export function readNearbyTiles(
  latitude: number,
  longitude: number
): { stores: LiquorStore[]; fetchedAt: number | null; stale: boolean; fresh: boolean } {
  const file = readFile();
  const tiles = tilesForPoint(latitude, longitude, CONFIG.geohashPrecision);
  const now = Date.now();
  const seen = new Set<string>();
  const stores: LiquorStore[] = [];
  let newest = 0;
  let oldest = Infinity;

  for (const hash of tiles) {
    const tile = file.tiles[hash];
    if (!tile) continue;
    tile.lastAccess = now;
    if (tile.fetchedAt > newest) newest = tile.fetchedAt;
    if (tile.fetchedAt < oldest) oldest = tile.fetchedAt;
    for (const store of tile.stores) {
      if (seen.has(store.id)) continue;
      seen.add(store.id);
      stores.push(store);
    }
  }

  if (stores.length > 0) writeFile(file);

  if (!newest) {
    return { stores: [], fetchedAt: null, stale: true, fresh: false };
  }

  const age = now - newest;
  return {
    stores,
    fetchedAt: newest,
    stale: age > CONFIG.cacheFreshMs,
    fresh: age <= CONFIG.cacheFreshMs,
  };
}

/** Write a result set into the tiles those POIs actually occupy. */
export function writeStoresToTiles(stores: LiquorStore[], fetchedAt = Date.now()): void {
  if (stores.length === 0) return;
  const file = readFile();
  const grouped = new Map<string, LiquorStore[]>();

  for (const store of stores) {
    const hash = encodeGeohash(store.latitude, store.longitude, CONFIG.geohashPrecision);
    const list = grouped.get(hash) ?? [];
    list.push(stripVolatile(store));
    grouped.set(hash, list);
  }

  for (const [hash, list] of grouped) {
    const existing = file.tiles[hash];
    const merged = mergeTileStores(existing?.stores ?? [], list);
    file.tiles[hash] = {
      geohash: hash,
      fetchedAt,
      lastAccess: fetchedAt,
      stores: merged,
    };
  }

  writeFile(file);
}

function mergeTileStores(existing: LiquorStore[], incoming: LiquorStore[]): LiquorStore[] {
  const byId = new Map<string, LiquorStore>();
  for (const store of existing) byId.set(store.id, store);
  for (const store of incoming) byId.set(store.id, store);
  return [...byId.values()];
}

export function isCacheFresh(fetchedAt: number | null): boolean {
  if (fetchedAt == null) return false;
  return Date.now() - fetchedAt <= CONFIG.cacheFreshMs;
}

export function isCacheUsable(fetchedAt: number | null): boolean {
  if (fetchedAt == null) return false;
  return Date.now() - fetchedAt <= CONFIG.cacheStaleMs;
}

/** @deprecated kept so older tests compile; v2 cache is tiled. */
export type CacheEntry = {
  queryLat: number;
  queryLon: number;
  radiusMeters: number;
  fetchedAt: number;
  stores: LiquorStore[];
};

export function readCache(): CacheEntry | null {
  const file = readFile();
  const tiles = Object.values(file.tiles);
  if (tiles.length === 0) return null;
  const newest = tiles.reduce((a, b) => (a.fetchedAt > b.fetchedAt ? a : b));
  const stores = tiles.flatMap((t) => t.stores);
  return {
    queryLat: 0,
    queryLon: 0,
    radiusMeters: CONFIG.initialRadiusMeters,
    fetchedAt: newest.fetchedAt,
    stores,
  };
}

export function writeCache(entry: CacheEntry): void {
  writeStoresToTiles(entry.stores, entry.fetchedAt);
}

export function isCacheStale(entry: CacheEntry): boolean {
  return Date.now() - entry.fetchedAt > CONFIG.cacheFreshMs;
}

export function isCacheOutOfRange(distanceFromQueryOriginMeters: number): boolean {
  return distanceFromQueryOriginMeters > CONFIG.refreshDistanceMeters;
}

export function clearCache(): void {
  if (!canUseStorage()) return;
  try {
    localStorage.removeItem(CONFIG.cacheStorageKey);
  } catch {
    // ignore
  }
}
