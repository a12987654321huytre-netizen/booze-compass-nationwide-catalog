const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

const NEIGHBORS = {
  n: ['p0r21436x8zb9dcf5h7kjnmqesgutwvy', 'bc01fg45238967deuvhjyznpkmstqrwx'],
  s: ['14365h7k9dcfesgujnmqp0r2twvyx8zb', '238967debc01fg45kmstqrwxuvhjyznp'],
  e: ['bc01fg45238967deuvhjyznpkmstqrwx', 'p0r21436x8zb9dcf5h7kjnmqesgutwvy'],
  w: ['238967debc01fg45kmstqrwxuvhjyznp', '14365h7k9dcfesgujnmqp0r2twvyx8zb'],
} as const;

const BORDERS = {
  n: ['prxz', 'bcfguvyz'],
  s: ['028b', '0145hjnp'],
  e: ['bcfguvyz', 'prxz'],
  w: ['0145hjnp', '028b'],
} as const;

/** Encode a coordinate to a geohash string. Precision 5 ≈ 4.9 km cells. */
export function encodeGeohash(latitude: number, longitude: number, precision = 5): string {
  let idx = 0;
  let bit = 0;
  let evenBit = true;
  let geohash = '';

  let latMin = -90;
  let latMax = 90;
  let lonMin = -180;
  let lonMax = 180;

  while (geohash.length < precision) {
    if (evenBit) {
      const lonMid = (lonMin + lonMax) / 2;
      if (longitude >= lonMid) {
        idx = idx * 2 + 1;
        lonMin = lonMid;
      } else {
        idx = idx * 2;
        lonMax = lonMid;
      }
    } else {
      const latMid = (latMin + latMax) / 2;
      if (latitude >= latMid) {
        idx = idx * 2 + 1;
        latMin = latMid;
      } else {
        idx = idx * 2;
        latMax = latMid;
      }
    }
    evenBit = !evenBit;
    bit += 1;
    if (bit === 5) {
      geohash += BASE32.charAt(idx);
      bit = 0;
      idx = 0;
    }
  }
  return geohash;
}

function adjacent(hash: string, dir: 'n' | 's' | 'e' | 'w'): string {
  if (!hash) return '';
  const last = hash.slice(-1);
  const parent = hash.slice(0, -1);
  const type = hash.length % 2;
  if (BORDERS[dir][type].includes(last) && parent) {
    return adjacent(parent, dir) + BASE32.charAt(NEIGHBORS[dir][type].indexOf(last));
  }
  return parent + BASE32.charAt(NEIGHBORS[dir][type].indexOf(last));
}

export function geohashNeighbors(hash: string): string[] {
  const n = adjacent(hash, 'n');
  const s = adjacent(hash, 's');
  const e = adjacent(hash, 'e');
  const w = adjacent(hash, 'w');
  return [n, s, e, w, adjacent(n, 'e'), adjacent(n, 'w'), adjacent(s, 'e'), adjacent(s, 'w')].filter(Boolean);
}

/** Centre tile plus 8 neighbours so a search near a cell edge still hits cache. */
export function tilesForPoint(latitude: number, longitude: number, precision: number): string[] {
  const hash = encodeGeohash(latitude, longitude, precision);
  return [hash, ...geohashNeighbors(hash)];
}
