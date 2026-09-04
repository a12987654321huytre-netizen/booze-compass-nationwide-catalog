import type { OsmTags } from '../lib/osmFormat';
import type { LiquorScoreResult } from '../lib/liquorScoring';
import type { SAProvince } from '../lib/saGeography';

/** How the liquor business sits in the real world. */
export type LiquorLocationType = 'standalone' | 'attached-counter';

/**
 * Where a POI came from.
 *
 * `google-places` is a durable discovery observation that was matched
 * as a genuinely new physical location and added to the catalog.
 * `places-fallback` remains the last-resort session overlay and is
 * never a catalog replacement.
 */
export type LiquorSource =
  | 'osm'
  | 'osm-seed'
  | 'curated'
  | 'cache'
  | 'google-places'
  | 'places-fallback';

export type LiquorStore = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  distanceMeters?: number;
  bearingDegrees?: number;
  openingHours?: string;
  address?: string;
  source: LiquorSource;
  /** Standalone bottle store vs liquor counter inside a parent business. */
  locationType: LiquorLocationType;
  /** Parent supermarket/mall brand when this is an attached counter. */
  parentName?: string;
  brand?: string;
  /**
   * How confident the classifier is that this is really a liquor
   * retailer (0-100). Not shown in the consumer UI.
   */
  matchConfidence?: number;
  /** Classifier reasons. Debug/dev only. */
  matchReasons?: string[];
  /** Other names we considered (brand, alt_name, operator, …). Debug only. */
  alternativeNames?: string[];
  /** Which field produced the display name. Debug only. */
  identitySource?: string;
  osmId?: string;
  /** Provider id. Stored separately from the internal POI id. */
  googlePlaceId?: string;
  phone?: string;
  website?: string;
  province?: SAProvince;
  city?: string;
};

export type OpenState = 'open' | 'closed' | 'unknown';

export type StoreStatus = {
  state: OpenState;
  /** e.g. "Open until 20:00" or "Opens at 09:00" — omitted when not confidently known. */
  label?: string;
};

/**
 * A raw candidate from any discovery source, before identity + ranking.
 * Classification has already run; identity may still rewrite the name.
 */
export type DiscoveredCandidate = {
  id: string;
  latitude: number;
  longitude: number;
  rawTags: OsmTags;
  score: LiquorScoreResult;
  source: LiquorSource;
  osmId?: string;
  googlePlaceId?: string;
  /** Curated records can assert a name/type before identity runs. */
  curatedName?: string;
  curatedType?: LiquorLocationType;
  curatedParentName?: string;
};

/**
 * Anything that can find liquor stores near a point implements this.
 * The UI only ever talks to the discovery orchestrator, so OSM/Overpass
 * can be swapped for a seed, a curated layer, or a paid fallback without
 * touching a single component.
 */
export interface LiquorStoreProvider {
  findNearby(
    latitude: number,
    longitude: number,
    radiusMeters: number
  ): Promise<LiquorStore[]>;
}

/** Coverage of a search, never shown to consumers. */
export type CoverageLevel = 'none' | 'thin' | 'ok' | 'strong';

export type DiscoveryMeta = {
  fromCache: boolean;
  cacheStale: boolean;
  overpassAttempted: boolean;
  overpassSucceeded: boolean;
  fallbackAttempted: boolean;
  coverage: CoverageLevel;
  sourcesUsed: LiquorSource[];
  rejectedCount: number;
};
