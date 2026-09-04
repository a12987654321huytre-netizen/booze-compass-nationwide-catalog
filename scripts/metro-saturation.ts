/**
 * Metro saturation pass — additive Google Places discovery.
 *
 * Does NOT replace the catalog. Existing IDs never change.
 * Capped Nearby results are subdivided, not treated as complete.
 *
 *   GOOGLE_PLACES_API_KEY=... npx tsx scripts/metro-saturation.ts
 *   GOOGLE_PLACES_API_KEY=... npx tsx scripts/metro-saturation.ts --resume
 *   GOOGLE_PLACES_API_KEY=... npx tsx scripts/metro-saturation.ts --report-only
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { SAProvince } from '../src/lib/saGeography';
import {
  dedupeObservations,
  nearbyLiquorSearch,
  textLiquorSearch,
  type GooglePlaceObservation,
  type GooglePlacesConfig,
  type GoogleQueryResult,
} from '../src/lib/googlePlacesProvider';
import {
  existingCatalogWithoutGoogle,
  googleCatalogPois,
  ingestObservations,
  type CatalogPoi,
  type GooglePlacesFile,
} from '../src/lib/poiCatalog';
import { applyAdditiveInserts, assertAdditive } from '../src/lib/poiIntegrity';
import type { ProviderSourceState } from '../src/lib/poiIntegrity';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_FILE = resolve(ROOT, 'src/data/googlePlacesPois.json');
const CHECKPOINT = resolve(ROOT, 'artifacts/metro-saturation-checkpoint.json');
const REPORT_FILE = resolve(ROOT, 'artifacts/metro-saturation-report.json');

type Metro = {
  id: string;
  name: string;
  province: SAProvince;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
  spacingKm: number;
  radiusMeters: number;
  afrikaans: boolean;
  hubs: Array<{ name: string; latitude: number; longitude: number }>;
};

const METROS: Metro[] = [
  {
    id: 'cape-town',
    name: 'Cape Town',
    province: 'Western Cape',
    minLat: -34.20,
    maxLat: -33.70,
    minLon: 18.37,
    maxLon: 18.92,
    spacingKm: 4.6,
    radiusMeters: 5200,
    afrikaans: true,
    hubs: [
      { name: 'Cape Town CBD', latitude: -33.9249, longitude: 18.4241 },
      { name: 'Bellville', latitude: -33.8943, longitude: 18.6292 },
      { name: 'Mitchells Plain', latitude: -34.0506, longitude: 18.6180 },
      { name: 'Khayelitsha', latitude: -34.0362, longitude: 18.6676 },
      { name: 'Claremont', latitude: -33.9806, longitude: 18.4653 },
      { name: 'Table View', latitude: -33.8236, longitude: 18.4892 },
      { name: 'Somerset West', latitude: -34.0760, longitude: 18.8430 },
      { name: 'Stellenbosch', latitude: -33.9321, longitude: 18.8602 },
    ],
  },
  {
    id: 'johannesburg',
    name: 'Johannesburg',
    province: 'Gauteng',
    minLat: -26.40,
    maxLat: -25.95,
    minLon: 27.78,
    maxLon: 28.18,
    spacingKm: 4.4,
    radiusMeters: 5000,
    afrikaans: false,
    hubs: [
      { name: 'Johannesburg CBD', latitude: -26.2041, longitude: 28.0473 },
      { name: 'Sandton', latitude: -26.1076, longitude: 28.0567 },
      { name: 'Soweto', latitude: -26.2678, longitude: 27.8585 },
      { name: 'Randburg', latitude: -26.0938, longitude: 28.0064 },
      { name: 'Roodepoort', latitude: -26.1625, longitude: 27.8725 },
      { name: 'Midrand', latitude: -25.9894, longitude: 28.1288 },
      { name: 'Alexandra', latitude: -26.1033, longitude: 28.0978 },
    ],
  },
  {
    id: 'ekurhuleni',
    name: 'Ekurhuleni',
    province: 'Gauteng',
    minLat: -26.38,
    maxLat: -26.00,
    minLon: 28.12,
    maxLon: 28.50,
    spacingKm: 4.6,
    radiusMeters: 5200,
    afrikaans: false,
    hubs: [
      { name: 'Kempton Park', latitude: -26.1000, longitude: 28.2300 },
      { name: 'Germiston', latitude: -26.2094, longitude: 28.1703 },
      { name: 'Boksburg', latitude: -26.2120, longitude: 28.2594 },
      { name: 'Benoni', latitude: -26.1885, longitude: 28.3208 },
      { name: 'Tembisa', latitude: -26.0080, longitude: 28.2100 },
      { name: 'Springs', latitude: -26.2500, longitude: 28.4000 },
    ],
  },
  {
    id: 'tshwane',
    name: 'Pretoria / Tshwane',
    province: 'Gauteng',
    minLat: -25.90,
    maxLat: -25.55,
    minLon: 28.00,
    maxLon: 28.42,
    spacingKm: 4.5,
    radiusMeters: 5000,
    afrikaans: true,
    hubs: [
      { name: 'Pretoria CBD', latitude: -25.7479, longitude: 28.2293 },
      { name: 'Centurion', latitude: -25.8601, longitude: 28.1894 },
      { name: 'Mamelodi', latitude: -25.7200, longitude: 28.3350 },
      { name: 'Soshanguve', latitude: -25.5228, longitude: 28.1006 },
      { name: 'Hatfield', latitude: -25.7480, longitude: 28.2380 },
    ],
  },
  {
    id: 'durban',
    name: 'Durban / eThekwini',
    province: 'KwaZulu-Natal',
    minLat: -30.05,
    maxLat: -29.60,
    minLon: 30.78,
    maxLon: 31.12,
    spacingKm: 4.5,
    radiusMeters: 5000,
    afrikaans: false,
    hubs: [
      { name: 'Durban CBD', latitude: -29.8587, longitude: 31.0218 },
      { name: 'Umhlanga', latitude: -29.7282, longitude: 31.0850 },
      { name: 'Chatsworth', latitude: -29.9167, longitude: 30.8833 },
      { name: 'Pinetown', latitude: -29.8167, longitude: 30.8667 },
      { name: 'Umlazi', latitude: -29.9667, longitude: 30.8833 },
      { name: 'Phoenix', latitude: -29.7000, longitude: 31.0000 },
    ],
  },
  {
    id: 'gqeberha',
    name: 'Gqeberha',
    province: 'Eastern Cape',
    minLat: -34.02,
    maxLat: -33.82,
    minLon: 25.40,
    maxLon: 25.68,
    spacingKm: 3.6,
    radiusMeters: 4200,
    afrikaans: true,
    hubs: [
      { name: 'Gqeberha CBD', latitude: -33.9608, longitude: 25.6022 },
      { name: 'Newton Park', latitude: -33.9450, longitude: 25.5700 },
      { name: 'Motherwell', latitude: -33.8040, longitude: 25.5890 },
    ],
  },
  {
    id: 'east-london',
    name: 'East London',
    province: 'Eastern Cape',
    minLat: -33.08,
    maxLat: -32.92,
    minLon: 27.80,
    maxLon: 28.00,
    spacingKm: 3.4,
    radiusMeters: 4000,
    afrikaans: true,
    hubs: [
      { name: 'East London CBD', latitude: -33.0153, longitude: 27.9116 },
      { name: 'Mdantsane', latitude: -32.9500, longitude: 27.7667 },
    ],
  },
  {
    id: 'bloemfontein',
    name: 'Bloemfontein',
    province: 'Free State',
    minLat: -29.22,
    maxLat: -29.04,
    minLon: 26.14,
    maxLon: 26.32,
    spacingKm: 3.2,
    radiusMeters: 3800,
    afrikaans: true,
    hubs: [
      { name: 'Bloemfontein CBD', latitude: -29.0852, longitude: 26.1596 },
      { name: 'Mangaung', latitude: -29.1500, longitude: 26.2200 },
    ],
  },
  {
    id: 'pietermaritzburg',
    name: 'Pietermaritzburg',
    province: 'KwaZulu-Natal',
    minLat: -29.68,
    maxLat: -29.54,
    minLon: 30.32,
    maxLon: 30.48,
    spacingKm: 3.2,
    radiusMeters: 3800,
    afrikaans: false,
    hubs: [{ name: 'Pietermaritzburg CBD', latitude: -29.6006, longitude: 30.3794 }],
  },
  {
    id: 'mbombela',
    name: 'Mbombela',
    province: 'Mpumalanga',
    minLat: -25.52,
    maxLat: -25.40,
    minLon: 30.92,
    maxLon: 31.08,
    spacingKm: 3.0,
    radiusMeters: 3600,
    afrikaans: true,
    hubs: [{ name: 'Mbombela CBD', latitude: -25.4753, longitude: 30.9694 }],
  },
  {
    id: 'polokwane',
    name: 'Polokwane',
    province: 'Limpopo',
    minLat: -23.95,
    maxLat: -23.84,
    minLon: 29.40,
    maxLon: 29.52,
    spacingKm: 2.8,
    radiusMeters: 3400,
    afrikaans: true,
    hubs: [{ name: 'Polokwane CBD', latitude: -23.9045, longitude: 29.4689 }],
  },
  {
    id: 'kimberley',
    name: 'Kimberley',
    province: 'Northern Cape',
    minLat: -28.80,
    maxLat: -28.70,
    minLon: 24.72,
    maxLon: 24.82,
    spacingKm: 2.6,
    radiusMeters: 3200,
    afrikaans: true,
    hubs: [{ name: 'Kimberley CBD', latitude: -28.7282, longitude: 24.7499 }],
  },
  {
    id: 'rustenburg',
    name: 'Rustenburg',
    province: 'North West',
    minLat: -25.72,
    maxLat: -25.60,
    minLon: 27.18,
    maxLon: 27.32,
    spacingKm: 2.8,
    radiusMeters: 3400,
    afrikaans: true,
    hubs: [{ name: 'Rustenburg CBD', latitude: -25.6672, longitude: 27.2424 }],
  },
  {
    id: 'mahikeng',
    name: 'Mahikeng',
    province: 'North West',
    minLat: -25.90,
    maxLat: -25.80,
    minLon: 25.58,
    maxLon: 25.70,
    spacingKm: 2.6,
    radiusMeters: 3200,
    afrikaans: true,
    hubs: [{ name: 'Mahikeng CBD', latitude: -25.8601, longitude: 25.6406 }],
  },
  {
    id: 'welkom',
    name: 'Welkom',
    province: 'Free State',
    minLat: -28.02,
    maxLat: -27.92,
    minLon: 26.68,
    maxLon: 26.80,
    spacingKm: 2.6,
    radiusMeters: 3200,
    afrikaans: true,
    hubs: [{ name: 'Welkom CBD', latitude: -27.9830, longitude: 26.7130 }],
  },
  {
    id: 'newcastle',
    name: 'Newcastle',
    province: 'KwaZulu-Natal',
    minLat: -27.80,
    maxLat: -27.70,
    minLon: 29.90,
    maxLon: 30.02,
    spacingKm: 2.6,
    radiusMeters: 3200,
    afrikaans: false,
    hubs: [{ name: 'Newcastle CBD', latitude: -27.7580, longitude: 29.9318 }],
  },
  {
    id: 'vaal',
    name: 'Vaal Triangle',
    province: 'Gauteng',
    minLat: -26.78,
    maxLat: -26.60,
    minLon: 27.78,
    maxLon: 28.00,
    spacingKm: 3.4,
    radiusMeters: 4000,
    afrikaans: true,
    hubs: [
      { name: 'Vereeniging', latitude: -26.6731, longitude: 27.9319 },
      { name: 'Vanderbijlpark', latitude: -26.7117, longitude: 27.8380 },
    ],
  },
  {
    id: 'matlosana',
    name: 'Klerksdorp / Matlosana',
    province: 'North West',
    minLat: -26.92,
    maxLat: -26.80,
    minLon: 26.62,
    maxLon: 26.72,
    spacingKm: 2.8,
    radiusMeters: 3400,
    afrikaans: true,
    hubs: [{ name: 'Klerksdorp CBD', latitude: -26.8521, longitude: 26.6667 }],
  },
  {
    id: 'emalahleni',
    name: 'Emalahleni',
    province: 'Mpumalanga',
    minLat: -25.92,
    maxLat: -25.82,
    minLon: 29.18,
    maxLon: 29.28,
    spacingKm: 2.8,
    radiusMeters: 3400,
    afrikaans: true,
    hubs: [{ name: 'Emalahleni CBD', latitude: -25.8738, longitude: 29.2332 }],
  },
  {
    id: 'george',
    name: 'George',
    province: 'Western Cape',
    minLat: -34.02,
    maxLat: -33.94,
    minLon: 22.40,
    maxLon: 22.52,
    spacingKm: 2.6,
    radiusMeters: 3200,
    afrikaans: true,
    hubs: [{ name: 'George CBD', latitude: -33.9640, longitude: 22.4590 }],
  },
];

type SearchCell = {
  queryId: string;
  metroId: string;
  metroName: string;
  province: SAProvince;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  depth: number;
  kind: 'nearby' | 'text';
  textQuery?: string;
};

type QueryLog = {
  queryId: string;
  metroId: string;
  metroName: string;
  province: SAProvince;
  query: string;
  state: ProviderSourceState;
  count: number;
  rawResultCount: number;
  pages: number;
  nextPageAvailable: boolean;
  error?: string;
  depth: number;
};

type Checkpoint = {
  completedQueryIds: string[];
  observations: GooglePlaceObservation[];
  queries: QueryLog[];
  pending: SearchCell[];
  startedAt: string;
};

function parseArgs(argv: string[]) {
  return {
    resume: argv.includes('--resume'),
    reportOnly: argv.includes('--report-only'),
    apply: !argv.includes('--report-only'),
    metros: (() => {
      const idx = argv.indexOf('--metros');
      if (idx === -1) return null;
      const raw = argv[idx + 1] || '';
      const wanted = raw.split(',').map((s) => s.trim()).filter(Boolean);
      return wanted.length ? wanted : null;
    })(),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function atomicWrite(filePath: string, contents: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  writeFileSync(tmp, contents);
  try {
    renameSync(tmp, filePath);
  } catch {
    writeFileSync(filePath, contents);
  }
}

function loadCheckpoint(): Checkpoint | null {
  if (!existsSync(CHECKPOINT)) return null;
  try {
    return JSON.parse(readFileSync(CHECKPOINT, 'utf8')) as Checkpoint;
  } catch {
    return null;
  }
}

function saveCheckpoint(checkpoint: Checkpoint): void {
  atomicWrite(CHECKPOINT, JSON.stringify(checkpoint));
}

function gridCells(metro: Metro): SearchCell[] {
  const latKm = 111.32;
  const midLat = (metro.minLat + metro.maxLat) / 2;
  const lonKm = 111.32 * Math.cos((midLat * Math.PI) / 180);
  const latStep = metro.spacingKm / latKm;
  const lonStep = metro.spacingKm / lonKm;
  const cells: SearchCell[] = [];
  let row = 0;
  for (let lat = metro.minLat + latStep / 2; lat <= metro.maxLat; lat += latStep) {
    let col = 0;
    for (let lon = metro.minLon + lonStep / 2; lon <= metro.maxLon; lon += lonStep) {
      cells.push({
        queryId: `${metro.id}:nearby:${row}:${col}`,
        metroId: metro.id,
        metroName: metro.name,
        province: metro.province,
        latitude: Number(lat.toFixed(5)),
        longitude: Number(lon.toFixed(5)),
        radiusMeters: metro.radiusMeters,
        depth: 0,
        kind: 'nearby',
      });
      col += 1;
    }
    row += 1;
  }
  return cells;
}

function textCells(metro: Metro): SearchCell[] {
  const terms = ['liquor store', 'bottle store', 'liquor shop'];
  if (metro.afrikaans) terms.push('drankwinkel');
  const cells: SearchCell[] = [];
  for (const hub of metro.hubs) {
    for (const term of terms) {
      const slug = term.replace(/\s+/g, '-');
      cells.push({
        queryId: `${metro.id}:text:${hub.name}:${slug}`,
        metroId: metro.id,
        metroName: metro.name,
        province: metro.province,
        latitude: hub.latitude,
        longitude: hub.longitude,
        radiusMeters: Math.min(metro.radiusMeters * 2, 15000),
        depth: 0,
        kind: 'text',
        textQuery: `${term} in ${hub.name}, ${metro.province}, South Africa`,
      });
    }
    cells.push({
      queryId: `${metro.id}:text:${hub.name}:tops`,
      metroId: metro.id,
      metroName: metro.name,
      province: metro.province,
      latitude: hub.latitude,
      longitude: hub.longitude,
      radiusMeters: 12000,
      depth: 0,
      kind: 'text',
      textQuery: `TOPS at SPAR in ${hub.name}, South Africa`,
    });
  }
  return cells;
}

function subdivide(cell: SearchCell, metro: Metro): SearchCell[] {
  if (cell.kind !== 'nearby') return [];
  if (cell.depth >= 2) return [];
  if (cell.radiusMeters < 1400) return [];
  const childRadius = Math.max(1200, Math.round(cell.radiusMeters / 2.4));
  const latKm = 111.32;
  const lonKm = 111.32 * Math.cos((cell.latitude * Math.PI) / 180);
  const stepKm = (childRadius / 1000) * 0.85;
  const latStep = stepKm / latKm;
  const lonStep = stepKm / lonKm;
  const offsets = [-1, 0, 1];
  const out: SearchCell[] = [];
  for (const dy of offsets) {
    for (const dx of offsets) {
      const lat = cell.latitude + dy * latStep;
      const lon = cell.longitude + dx * lonStep;
      if (lat < metro.minLat - 0.01 || lat > metro.maxLat + 0.01) continue;
      if (lon < metro.minLon - 0.01 || lon > metro.maxLon + 0.01) continue;
      out.push({
        queryId: `${cell.queryId}:sub:${dy + 1}${dx + 1}:d${cell.depth + 1}`,
        metroId: cell.metroId,
        metroName: cell.metroName,
        province: cell.province,
        latitude: Number(lat.toFixed(5)),
        longitude: Number(lon.toFixed(5)),
        radiusMeters: childRadius,
        depth: cell.depth + 1,
        kind: 'nearby',
      });
    }
  }
  return out;
}

function wasCapped(result: GoogleQueryResult): boolean {
  return result.state === 'SOURCE_PARTIAL_RESULTS' || result.nextPageAvailable || result.rawResultCount >= 60;
}

async function withBackoff(label: string, run: () => Promise<GoogleQueryResult>): Promise<GoogleQueryResult> {
  let attempt = 0;
  let last: GoogleQueryResult | null = null;
  while (attempt < 4) {
    last = await run();
    if (last.state !== 'SOURCE_UNAVAILABLE' && last.state !== 'SOURCE_TIMEOUT') return last;
    const wait = 1800 * 2 ** attempt;
    console.warn(`  retry ${label} in ${wait}ms (${last.state}${last.error ? `: ${last.error}` : ''})`);
    await sleep(wait);
    attempt += 1;
  }
  return last!;
}

function compactPoi(poi: CatalogPoi): CatalogPoi {
  const out: CatalogPoi = {
    id: poi.id,
    name: poi.name,
    latitude: poi.latitude,
    longitude: poi.longitude,
    locationType: poi.locationType,
    source: poi.source,
  };
  if (poi.address) out.address = poi.address;
  if (poi.phone) out.phone = poi.phone;
  if (poi.website) out.website = poi.website;
  if (poi.openingHours) out.openingHours = poi.openingHours;
  if (poi.brand) out.brand = poi.brand;
  if (poi.parentName) out.parentName = poi.parentName;
  if (poi.osmId) out.osmId = poi.osmId;
  if (poi.googlePlaceId) out.googlePlaceId = poi.googlePlaceId;
  if (poi.province) out.province = poi.province;
  if (poi.city) out.city = poi.city;
  if (poi.matchConfidence != null) out.matchConfidence = poi.matchConfidence;
  return out;
}

function saturationLabel(input: {
  unique: number;
  added: number;
  capped: number;
  nearby: number;
  subdivisions: number;
}): 'LOW COVERAGE' | 'MODERATE COVERAGE' | 'HIGH COVERAGE' | 'SATURATED / DIMINISHING RETURNS' {
  if (input.nearby >= 8 && input.added <= 3 && input.capped === 0) return 'SATURATED / DIMINISHING RETURNS';
  if (input.capped > 4 && input.subdivisions < input.capped) return 'MODERATE COVERAGE';
  if (input.unique >= 80 && input.capped <= 2) return 'HIGH COVERAGE';
  if (input.unique >= 30) return 'MODERATE COVERAGE';
  return 'LOW COVERAGE';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) {
    console.error('GOOGLE_PLACES_API_KEY is required. Never bundle this key into the app.');
    process.exit(1);
  }

  const config: GooglePlacesConfig = { apiKey };
  const seedAndCurated = existingCatalogWithoutGoogle();
  const previousGoogle = googleCatalogPois();
  const existing = applyAdditiveInserts(seedAndCurated, previousGoogle).catalog;
  const originalIds = existing.map((poi) => poi.id);

  console.log(`Existing catalog: ${existing.length}`);
  console.log(`IDs that must survive: ${originalIds.length}`);

  let metros = METROS;
  if (args.metros) {
    const wanted = new Set(args.metros.map((m) => m.toLowerCase()));
    metros = METROS.filter((m) => wanted.has(m.id) || wanted.has(m.name.toLowerCase()));
  }

  const initial: SearchCell[] = [];
  for (const metro of metros) {
    const nearby = gridCells(metro);
    const text = textCells(metro);
    console.log(`  ${metro.name}: ${nearby.length} grid cells, ${text.length} text queries, radius ${metro.radiusMeters}m`);
    initial.push(...nearby, ...text);
  }

  const checkpoint: Checkpoint =
    args.resume && loadCheckpoint()
      ? loadCheckpoint()!
      : {
          completedQueryIds: [],
          observations: [],
          queries: [],
          pending: initial,
          startedAt: new Date().toISOString(),
        };

  if (args.resume && loadCheckpoint()) {
    const retryable = new Set(['SOURCE_FAILED', 'SOURCE_TIMEOUT', 'SOURCE_UNAVAILABLE']);
    const failedIds = new Set(
      checkpoint.queries.filter((q) => retryable.has(q.state)).map((q) => q.queryId)
    );
    if (failedIds.size) {
      checkpoint.completedQueryIds = checkpoint.completedQueryIds.filter((id) => !failedIds.has(id));
      checkpoint.queries = checkpoint.queries.filter((q) => !failedIds.has(q.queryId));
      console.log(`Re-queueing ${failedIds.size} failed/timeout queries`);
    }
    const done = new Set(checkpoint.completedQueryIds);
    const leftover = checkpoint.pending.filter((c) => !done.has(c.queryId));
    const missingInitial = initial.filter(
      (c) => !done.has(c.queryId) && !leftover.some((p) => p.queryId === c.queryId)
    );
    checkpoint.pending = [...leftover, ...missingInitial];
  } else if (!args.resume) {
    checkpoint.pending = initial;
  }

  console.log(`Queued ${checkpoint.pending.length} queries (${checkpoint.completedQueryIds.length} already done)`);

  const metroById = new Map(metros.map((m) => [m.id, m]));
  let processed = 0;

  while (checkpoint.pending.length > 0) {
    const cell = checkpoint.pending.shift()!;
    if (checkpoint.completedQueryIds.includes(cell.queryId)) continue;

    const result = await withBackoff(cell.queryId, () =>
      cell.kind === 'nearby'
        ? nearbyLiquorSearch(
            {
              queryId: cell.queryId,
              latitude: cell.latitude,
              longitude: cell.longitude,
              radiusMeters: cell.radiusMeters,
              paginate: true,
            },
            config
          )
        : textLiquorSearch(
            {
              queryId: cell.queryId,
              textQuery: cell.textQuery!,
              latitude: cell.latitude,
              longitude: cell.longitude,
              radiusMeters: cell.radiusMeters,
              paginate: true,
            },
            config
          )
    );

    checkpoint.completedQueryIds.push(cell.queryId);
    checkpoint.observations.push(...result.observations);
    checkpoint.queries.push({
      queryId: cell.queryId,
      metroId: cell.metroId,
      metroName: cell.metroName,
      province: cell.province,
      query: result.query,
      state: result.state,
      count: result.observations.length,
      rawResultCount: result.rawResultCount,
      pages: result.pages,
      nextPageAvailable: result.nextPageAvailable,
      error: result.error,
      depth: cell.depth,
    });

    if (cell.kind === 'nearby' && wasCapped(result)) {
      const metro = metroById.get(cell.metroId);
      if (metro) {
        const children = subdivide(cell, metro).filter(
          (child) => !checkpoint.completedQueryIds.includes(child.queryId)
        );
        if (children.length) {
          console.log(`  CAP ${cell.queryId} raw=${result.rawResultCount} → +${children.length} subdivisions`);
          checkpoint.pending.push(...children);
        }
      }
    }

    processed += 1;
    if (processed % 8 === 0 || result.state !== 'SOURCE_SUCCESS') {
      saveCheckpoint(checkpoint);
      console.log(
        `  [${processed} done, ${checkpoint.pending.length} queued] ${cell.queryId} ${result.state} raw=${result.rawResultCount} kept=${result.observations.length} unique=${dedupeObservations(checkpoint.observations).length}`
      );
    }
    await sleep(70);
  }

  saveCheckpoint(checkpoint);

  const observations = dedupeObservations(checkpoint.observations);
  console.log(`\nUnique Google observations this pass: ${observations.length}`);
  console.log('Matching against existing catalog (additive, no deletes)...');

  const ingested = ingestObservations(existing, observations);
  assertAdditive(originalIds, ingested.catalog.map((p) => p.id), 'metro-saturation');

  const reports = metros.map((metro) => {
    const queries = checkpoint.queries.filter((q) => q.metroId === metro.id);
    const nearby = queries.filter((q) => q.query.startsWith('nearby'));
    const text = queries.filter((q) => !q.query.startsWith('nearby'));
    const states: Record<string, number> = {};
    for (const q of queries) states[q.state] = (states[q.state] ?? 0) + 1;
    const metroObs = observations.filter((o) => {
      return (
        o.latitude >= metro.minLat - 0.03 &&
        o.latitude <= metro.maxLat + 0.03 &&
        o.longitude >= metro.minLon - 0.03 &&
        o.longitude <= metro.maxLon + 0.03
      );
    });
    const metroAdded = ingested.added.filter((p) => {
      return (
        p.latitude >= metro.minLat - 0.03 &&
        p.latitude <= metro.maxLat + 0.03 &&
        p.longitude >= metro.minLon - 0.03 &&
        p.longitude <= metro.maxLon + 0.03
      );
    });
    const metroReview = ingested.reviewCandidates.filter((r) => r.province === metro.province);
    const capped = queries.filter((q) => q.state === 'SOURCE_PARTIAL_RESULTS' || q.nextPageAvailable || (q.rawResultCount ?? 0) >= 60).length;
    const zero = queries.filter((q) => q.state === 'SOURCE_ZERO_RESULTS').length;
    const success = queries.filter((q) => q.state === 'SOURCE_SUCCESS').length;
    const failed = queries.filter((q) =>
      q.state === 'SOURCE_FAILED' || q.state === 'SOURCE_TIMEOUT' || q.state === 'SOURCE_UNAVAILABLE'
    ).length;
    const subdivisions = nearby.filter((q) => q.depth > 0).length;
    const unique = metroObs.length;
    const added = metroAdded.length;
    const saturation = saturationLabel({
      unique,
      added,
      capped,
      nearby: nearby.length,
      subdivisions,
    });
    const why =
      saturation === 'SATURATED / DIMINISHING RETURNS'
        ? `Grid returned ${unique} unique observations and only ${added} genuinely new locations; capped queries=${capped}. Further subdivision is unlikely to expose many new physical stores.`
        : saturation === 'HIGH COVERAGE'
          ? `Dense overlapping nearby+text search exposed ${unique} unique observations with few caps (${capped}). Google is well populated here, but this is still not a guarantee of completeness.`
          : saturation === 'MODERATE COVERAGE'
            ? `Search exposed ${unique} unique observations; ${capped} queries hit Google's result cap and ${subdivisions} subdivisions were run. Some stores may still be hidden behind the 60-result nearby ceiling.`
            : `Few observations (${unique}) relative to the urban area. Google may be thin here, the grid may still be coarse, or classification rejected many dining/tavern results.`;

    return {
      metro: metro.name,
      metroId: metro.id,
      province: metro.province,
      geographicArea: {
        minLat: metro.minLat,
        maxLat: metro.maxLat,
        minLon: metro.minLon,
        maxLon: metro.maxLon,
        spacingKm: metro.spacingKm,
        radiusMeters: metro.radiusMeters,
      },
      searchPoints: nearby.filter((q) => q.depth === 0).length,
      subdivisionQueries: subdivisions,
      textQueries: text.length,
      googleQueries: queries.length,
      successfulQueries: success,
      partialCappedQueries: capped,
      zeroResultQueries: zero,
      failedQueries: failed,
      queryStates: states,
      rawObservations: queries.reduce((n, q) => n + q.rawResultCount, 0),
      uniqueGoogleObservations: unique,
      genuinelyNewPois: added,
      poisAdded: args.apply ? added : 0,
      reviewCandidatesInProvince: metroReview.length,
      saturation,
      saturationWhy: why,
      note: 'These are unique observations Google Places exposed through this search strategy, not a complete count of stores in the metro.',
    };
  });

  const report = {
    startedAt: checkpoint.startedAt,
    finishedAt: new Date().toISOString(),
    existingCatalogBefore: existing.length,
    originalIdsPreserved: originalIds.length,
    googleObservationsThisPass: checkpoint.observations.length,
    uniqueGoogleObservationsThisPass: observations.length,
    confirmedMatches: ingested.confirmedMatches,
    likelyMatches: ingested.likelyMatches,
    possibleMatches: ingested.possibleMatches,
    newPoiCandidates: ingested.newPoiCandidates,
    addedThisPass: ingested.added.length,
    catalogAfterIfApplied: ingested.catalog.length,
    applied: args.apply,
    safety: {
      noDeletes: originalIds.every((id) => ingested.catalog.some((p) => p.id === id)),
      idsUnchanged: true,
      additiveOnly: ingested.catalog.length >= existing.length,
      existingCount: existing.length,
    },
    metros: reports,
  };

  atomicWrite(REPORT_FILE, JSON.stringify(report, null, 2));
  console.log(`\nReport written to ${REPORT_FILE}`);
  for (const row of reports) {
    console.log(
      `${row.metro}: queries=${row.googleQueries} unique=${row.uniqueGoogleObservations} new=${row.genuinelyNewPois} capped=${row.partialCappedQueries} → ${row.saturation}`
    );
  }

  if (!args.apply) {
    console.log('\n--report-only: catalog file not modified.');
    return;
  }

  const priorFile = existsSync(OUT_FILE)
    ? (JSON.parse(readFileSync(OUT_FILE, 'utf8')) as GooglePlacesFile)
    : { version: 1, generatedAt: null, pois: [], enrichment: [], reviewCandidates: [] };

  const nextFile: GooglePlacesFile = {
    version: 1,
    generatedAt: new Date().toISOString(),
    pois: ingested.catalog.filter((p) => p.source === 'google-places').map(compactPoi),
    enrichment: [...(priorFile.enrichment ?? []), ...ingested.enrichment],
    reviewCandidates: [...(priorFile.reviewCandidates ?? []), ...ingested.reviewCandidates],
    audit: report,
  };

  // Final safety: seed+curated+previous Google IDs must all remain.
  assertAdditive(originalIds, ingested.catalog.map((p) => p.id), 'metro-saturation-write');
  atomicWrite(OUT_FILE, JSON.stringify(nextFile));
  console.log(`Catalog updated additively: ${existing.length} → ${ingested.catalog.length} (+${ingested.added.length})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
