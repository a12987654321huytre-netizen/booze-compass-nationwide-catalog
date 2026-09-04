import type { LiquorLocationType } from '../types/store';

export type CuratedAddition = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  type: LiquorLocationType;
  parentName?: string;
  address?: string;
  openingHours?: string;
  notes?: string;
};

export type CuratedRename = {
  osmId?: string;
  matchName: string;
  latitude: number;
  longitude: number;
  radiusMeters?: number;
  name: string;
  type?: LiquorLocationType;
  parentName?: string;
};

export type CuratedExclusion = {
  osmId?: string;
  matchName: string;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  reason: string;
};

/**
 * Small, intentional corrections for known OSM data-quality problems.
 * This is NOT a database of every bottle store in South Africa.
 *
 * Additions: liquor outlets OSM does not represent as their own POI
 * (Woolworths Cellar inside a Woolworths, Market Liquor inside a
 * Food Lover's Market). Coordinates are the parent store, because
 * that's where the counter actually is.
 *
 * Renames: OSM has the shop but the name is useless ("W Cellar").
 *
 * Exclusions: OSM tagged something as shop=alcohol/wine that is not
 * a bottle store (gallery, wine estate already filtered by classifier).
 */
export const CURATED_ADDITIONS: CuratedAddition[] = [
  {
    id: 'curated-ww-cellar-stellenbosch-cbd',
    name: 'Woolworths Cellar',
    latitude: -33.9357543,
    longitude: 18.8601595,
    type: 'attached-counter',
    parentName: 'Woolworths',
    address: 'Stellenbosch CBD',
    notes: 'OSM has the Woolworths supermarket, not the Cellar counter.',
  },
  {
    id: 'curated-ww-cellar-cavendish',
    name: 'Woolworths Cellar',
    latitude: -33.9811691,
    longitude: 18.4633174,
    type: 'attached-counter',
    parentName: 'Woolworths',
    address: 'Cavendish Square, Claremont',
    notes: 'OSM has Woolworths supermarket only.',
  },
  {
    id: 'curated-ww-cellar-va',
    name: 'Woolworths Cellar',
    latitude: -33.9033093,
    longitude: 18.4214281,
    type: 'attached-counter',
    parentName: 'Woolworths',
    address: 'V&A Waterfront',
    notes: 'OSM has Woolworths supermarket only.',
  },
  {
    id: 'curated-market-liquor-foreshore',
    name: 'Market Liquor',
    latitude: -33.9174724,
    longitude: 18.4236538,
    type: 'attached-counter',
    parentName: "Food Lover's Market",
    address: "Food Lover's Market, Cape Town",
    notes: "OSM has Food Lover's Market with no Market Liquor node.",
  },
];

export const CURATED_RENAMES: CuratedRename[] = [
  {
    osmId: 'osm-node-unknown-w-cellar',
    matchName: 'W Cellar',
    latitude: -33.9771652,
    longitude: 18.8427523,
    radiusMeters: 80,
    name: 'Woolworths Cellar',
    type: 'attached-counter',
    parentName: 'Woolworths',
  },
];

export const CURATED_EXCLUSIONS: CuratedExclusion[] = [
  {
    matchName: 'What If The World',
    latitude: -33.9275,
    longitude: 18.45487,
    radiusMeters: 80,
    reason: 'Art gallery, incorrectly tagged shop=wine.',
  },
  {
    matchName: 'Saltare',
    latitude: -33.93828,
    longitude: 18.86819,
    radiusMeters: 80,
    reason: 'Wine farm tasting venue tagged shop=wine, not a bottle store.',
  },
  {
    matchName: 'Wellington Wine Route',
    latitude: -33.9221814,
    longitude: 18.4409577,
    radiusMeters: 200,
    reason: 'Wine-tourism office, not a bottle store. Kept in catalog (no deletion) but excluded from compass ranking.',
  },
];
