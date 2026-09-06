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
  {
    matchName: 'Nitida Winery',
    latitude: -33.8342543,
    longitude: 18.5937463,
    radiusMeters: 120,
    reason: 'Winery / tasting venue, not a bottle store.',
  },
  {
    matchName: 'Groot Constantia Winery',
    latitude: -34.0267934,
    longitude: 18.4246103,
    radiusMeters: 120,
    reason: 'Wine estate cellar door, not a bottle store.',
  },
  {
    matchName: 'Hidden Valley Wine Estate',
    latitude: -34.0209191,
    longitude: 18.8527736,
    radiusMeters: 120,
    reason: 'Wine estate, not a bottle store.',
  },
  {
    matchName: 'Uva Mira Wine Estate',
    latitude: -34.0253919,
    longitude: 18.8571402,
    radiusMeters: 120,
    reason: 'Wine estate, not a bottle store.',
  },
  {
    matchName: 'Hartenberg Estate',
    latitude: -33.8987275,
    longitude: 18.7918839,
    radiusMeters: 120,
    reason: 'Wine estate, not a bottle store.',
  },
  {
    matchName: 'Meerlust',
    latitude: -34.0169897,
    longitude: 18.7570384,
    radiusMeters: 120,
    reason: 'Wine estate, not a bottle store.',
  },
  {
    matchName: 'Annandale Estate',
    latitude: -33.9969465,
    longitude: 18.8308927,
    radiusMeters: 120,
    reason: 'Wine estate, not a bottle store.',
  },
  {
    matchName: 'Jordan Wine Estate',
    latitude: -33.9422307,
    longitude: 18.7424047,
    radiusMeters: 120,
    reason: 'Wine estate, not a bottle store.',
  },
  {
    matchName: 'Anthonij Rupert Winery',
    latitude: -33.8818744,
    longitude: 19.0242429,
    radiusMeters: 120,
    reason: 'Winery / tasting venue, not a bottle store.',
  },
  {
    matchName: 'Neil Joubert Wines',
    latitude: -33.8316964,
    longitude: 18.9002368,
    radiusMeters: 120,
    reason: 'Wine producer, not a bottle store.',
  },
  {
    matchName: 'Eikendal Estate',
    latitude: -34.0130206,
    longitude: 18.8234709,
    radiusMeters: 120,
    reason: 'Wine estate, not a bottle store.',
  },
  {
    matchName: 'Bein Wine',
    latitude: -33.9618756,
    longitude: 18.7356317,
    radiusMeters: 120,
    reason: 'Stellenbosch private cellar / tasting by appointment, not a bottle store.',
  },
  {
    matchName: 'Peter Falke wine tastery',
    latitude: -34.0003205,
    longitude: 18.8391284,
    radiusMeters: 120,
    reason: 'Wine estate tasting room, not a bottle store.',
  },
  {
    matchName: 'Zorgvliet Wine tasting',
    latitude: -33.9130034,
    longitude: 18.930379,
    radiusMeters: 120,
    reason: 'Wine estate tasting room, not a bottle store.',
  },
  {
    matchName: 'Tasting room',
    latitude: -33.8586321,
    longitude: 18.9864773,
    radiusMeters: 80,
    reason: 'Producer tasting room in the Paarl/Simondium wine area, not a bottle store.',
  },
  {
    matchName: 'J.C. Le Roux',
    latitude: -33.904438,
    longitude: 18.8103205,
    radiusMeters: 120,
    reason: 'House of JC Le Roux sparkling-wine tasting venue, not a bottle store.',
  },
  {
    matchName: 'Bartinney',
    latitude: -33.9262342,
    longitude: 18.9324574,
    radiusMeters: 120,
    reason: 'Bartinney Wine Estate tasting shed, not a bottle store.',
  },
  {
    matchName: 'Camber',
    latitude: -33.918791,
    longitude: 18.93233,
    radiusMeters: 120,
    reason: 'Camberley Wines farm tasting room, not a bottle store.',
  },
];
