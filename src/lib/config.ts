/**
 * All the tunable knobs for the data layer live here so nobody has to go
 * hunting through components to change a radius or a cache duration.
 */
export const CONFIG = {
  /**
   * Radii (metres) to try in order, both for automatic widening when a
   * search finds nothing, and for the manual "Widen the net" action.
   * Starts at 5km, jumps to 10km, then climbs in 5km steps up to a
   * 50km cap. Never jump to 50km on first launch.
   */
  searchRadiiMeters: [5000, 10000, 15000, 20000, 25000, 30000, 35000, 40000, 45000, 50000] as number[],

  /** Default first query radius. */
  initialRadiusMeters: 5000,

  /** Cache is treated as fresh — no network refresh — under this age. */
  cacheFreshMs: 2 * 60 * 60 * 1000, // 2 hours

  /** Stale-but-usable: show immediately, refresh in the background. */
  cacheStaleMs: 7 * 24 * 60 * 60 * 1000, // 7 days

  /** Legacy alias used by older tests; treated as the fresh window. */
  cacheMaxAgeMs: 2 * 60 * 60 * 1000,

  /** Re-query if the user has wandered this far from where we last queried. */
  refreshDistanceMeters: 2500,

  /**
   * Overpass endpoints to race. First successful JSON wins; the rest
   * are aborted. The original list put overpass-api.de first — that
   * mirror is often unreachable. FR is currently the most reliable
   * public instance we measured, so it leads, with the others as
   * fallbacks in the race.
   */
  overpassEndpoints: [
    'https://overpass.openstreetmap.fr/api/interpreter',
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
  ],

  /** Abort the whole Overpass race after this long. */
  overpassTimeoutMs: 8000,

  /** localStorage key for the tiled store cache. */
  cacheStorageKey: 'booze-compass:store-cache:v2',

  /** localStorage key for the user's "nearest" vs "nearest open" preference. */
  filterPrefStorageKey: 'booze-compass:filter-pref:v1',

  /** How many degrees of raw heading jitter to smooth away per frame. */
  headingSmoothingAlpha: 0.18,

  /** Max degrees the arrow may step per animation frame (caps overshoot). */
  headingMaxStepPerFrame: 6,

  /** Distance at which we consider the user to have arrived. */
  arrivalRadiusMeters: 40,

  /** Cluster two POIs as the same destination under this distance. */
  dedupeDistanceMeters: 60,

  /** Geohash precision for cache tiles (~5 km cells). */
  geohashPrecision: 5,

  /** Max tiles kept in localStorage. LRU evicts the rest. */
  cacheMaxTiles: 80,

  /**
   * Paid Places fallback. Off unless a server-side key is configured.
   * Never the default request path — see fallbackProvider.ts.
   */
  paidFallbackEnabled: false,

  /** Session-only TTL if a paid fallback result is ever returned. */
  paidFallbackTtlMs: 24 * 60 * 60 * 1000,
} as const;
