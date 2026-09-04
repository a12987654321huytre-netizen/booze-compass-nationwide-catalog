import type { DiscoveredCandidate } from '../types/store';
import { getDistanceMeters } from './geo';
import { elementToCandidate } from './overpassProvider';
import type { OverpassElement } from './overpassProvider';
import osmSeed from '../data/osm-seed.json';

type SeedRecord = {
  type: OverpassElement['type'] | string;
  id: number;
  lat: number;
  lon: number;
  tags: Record<string, string | undefined>;
};

const SEED = osmSeed as SeedRecord[];

/**
 * Bundled OSM snapshot. Historically densest in the Western Cape because
 * that is where the first extract was taken — not because Cape Town is
 * the product. Nationwide coverage is additive: this snapshot + curated
 * corrections + the Google Places discovery catalog + live Overpass.
 *
 * Identity is resolved at read-time so naming improvements apply without
 * rebuilding the snapshot.
 */
export function findSeedCandidates(
  latitude: number,
  longitude: number,
  radiusMeters: number
): DiscoveredCandidate[] {
  const out: DiscoveredCandidate[] = [];
  for (const record of SEED) {
    const distance = getDistanceMeters(latitude, longitude, record.lat, record.lon);
    if (distance > radiusMeters) continue;
    const element: OverpassElement = {
      type: record.type as OverpassElement['type'],
      id: record.id,
      lat: record.lat,
      lon: record.lon,
      tags: record.tags,
    };
    const candidate = elementToCandidate(element, 'osm-seed');
    if (candidate) out.push(candidate);
  }
  return out;
}

export function seedCount(): number {
  return SEED.length;
}
