/**
 * Non-negotiable data-integrity rules for Booze Compass POI discovery.
 *
 * External providers (OSM, Overpass, Google Places, …) are discovery
 * inputs, never authoritative snapshots. A provider returning 4 results
 * must not delete the other 20. Absence, failure, timeout, and
 * zero-results never imply the existing catalog is empty.
 */

export const PROVIDER_SOURCE_STATES = [
  'SOURCE_FAILED',
  'SOURCE_TIMEOUT',
  'SOURCE_UNAVAILABLE',
  'SOURCE_ZERO_RESULTS',
  'SOURCE_PARTIAL_RESULTS',
  'SOURCE_SUCCESS',
] as const;

export type ProviderSourceState = (typeof PROVIDER_SOURCE_STATES)[number];

/** None of these may trigger deletion of existing POIs. */
export const NON_DESTRUCTIVE_SOURCE_STATES: readonly ProviderSourceState[] = [
  'SOURCE_FAILED',
  'SOURCE_TIMEOUT',
  'SOURCE_UNAVAILABLE',
  'SOURCE_ZERO_RESULTS',
  'SOURCE_PARTIAL_RESULTS',
  'SOURCE_SUCCESS',
] as const;

export type CatalogRecord = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

export class IntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IntegrityError';
  }
}

/**
 * The only legal way to remove a POI: target its internal id.
 * Name, brand, category, provider membership, and geography are
 * never sufficient on their own.
 */
export function deletePoiById<T extends CatalogRecord>(catalog: readonly T[], id: string): T[] {
  if (!id || typeof id !== 'string') {
    throw new IntegrityError('Deletion requires an explicit internal POI id');
  }
  return catalog.filter((poi) => poi.id !== id);
}

/**
 * Merge two records that have already been confirmed as the same
 * physical location. Unrelated ids are untouched. The loser is removed
 * only because both ids were named explicitly.
 */
export function mergeDuplicatePair<T extends CatalogRecord>(
  catalog: readonly T[],
  keepId: string,
  dropId: string,
  merge: (keep: T, drop: T) => T
): T[] {
  if (!keepId || !dropId || keepId === dropId) {
    throw new IntegrityError('Merge requires two distinct explicit POI ids');
  }
  const keep = catalog.find((poi) => poi.id === keepId);
  const drop = catalog.find((poi) => poi.id === dropId);
  if (!keep || !drop) {
    throw new IntegrityError('Merge target not found — refusing to guess');
  }
  const merged = merge(keep, drop);
  return catalog
    .filter((poi) => poi.id !== dropId)
    .map((poi) => (poi.id === keepId ? { ...merged, id: keepId } : poi));
}

export type AdditiveMergeResult<T extends CatalogRecord> = {
  catalog: T[];
  added: T[];
  /** Every original id still present. */
  preservedIds: string[];
};

/**
 * Discovery is strictly additive. Incoming records are appended when
 * their ids are new. Existing records are never removed, even if the
 * provider returned nothing.
 */
export function applyAdditiveInserts<T extends CatalogRecord>(
  existing: readonly T[],
  incoming: readonly T[]
): AdditiveMergeResult<T> {
  const catalog = [...existing];
  const seen = new Set(existing.map((poi) => poi.id));
  const added: T[] = [];
  for (const poi of incoming) {
    if (!poi.id) continue;
    if (seen.has(poi.id)) continue;
    seen.add(poi.id);
    catalog.push(poi);
    added.push(poi);
  }
  return {
    catalog,
    added,
    preservedIds: existing.map((poi) => poi.id),
  };
}

/**
 * Guard used by every provider-ingest path. If a caller ever tries to
 * replace the catalog with a provider snapshot, throw rather than
 * silently destroy data.
 */
export function assertAdditive(
  beforeIds: readonly string[],
  afterIds: readonly string[],
  context: string
): void {
  const after = new Set(afterIds);
  const missing = beforeIds.filter((id) => !after.has(id));
  if (missing.length > 0) {
    throw new IntegrityError(
      `${context}: discovery removed ${missing.length} existing POI(s); first=${missing[0]}. Absence from a provider is not deletion.`
    );
  }
}

export function sourceStateAllowsDeletion(_state: ProviderSourceState): false {
  return false;
}

export function fillEmptyFields<T extends Record<string, unknown>>(
  existing: T,
  candidate: Partial<T>,
  keys: (keyof T)[]
): T {
  const next = { ...existing };
  for (const key of keys) {
    const current = next[key];
    const incoming = candidate[key];
    const empty =
      current === undefined ||
      current === null ||
      current === '' ||
      (Array.isArray(current) && current.length === 0);
    if (empty && incoming !== undefined && incoming !== null && incoming !== '') {
      next[key] = incoming as T[typeof key];
    }
  }
  return next;
}
