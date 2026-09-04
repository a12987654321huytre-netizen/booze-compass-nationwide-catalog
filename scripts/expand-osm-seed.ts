/**
 * Additive nationwide OSM seed expansion.
 *
 * Existing Western Cape rows stay. New shop=alcohol / shop=wine /
 * alcohol=yes POIs from the rest of South Africa are appended.
 * Overpass returning 0 or a thin province must never delete a row.
 *
 * Usage: npm run expand:osm-seed
 */
import { readFileSync, renameSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SA_PROVINCES, type SAProvince } from '../src/lib/saGeography';
import { CONFIG } from '../src/lib/config';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SEED_FILE = resolve(ROOT, 'src/data/osm-seed.json');

type SeedRecord = {
  type: string;
  id: number;
  lat: number;
  lon: number;
  tags: Record<string, string>;
};

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

const TAG_KEEP = [
  'name',
  'name:en',
  'brand',
  'official_name',
  'alt_name',
  'short_name',
  'operator',
  'shop',
  'alcohol',
  'opening_hours',
  'addr:city',
  'addr:street',
  'addr:housenumber',
  'addr:suburb',
  'addr:postcode',
  'addr:full',
  'phone',
  'website',
  'craft',
  'tourism',
  'amenity',
  'ref',
];

/** Slightly padded province boxes used only for this extract. */
const EXTRACT_BOXES: Array<{ province: SAProvince; s: number; w: number; n: number; e: number }> = [
  { province: 'Western Cape', s: -34.9, w: 17.7, n: -31.0, e: 24.05 },
  { province: 'Eastern Cape', s: -34.5, w: 22.8, n: -30.0, e: 30.3 },
  { province: 'Northern Cape', s: -32.6, w: 16.35, n: -24.4, e: 25.55 },
  { province: 'Free State', s: -30.7, w: 24.85, n: -26.5, e: 29.85 },
  { province: 'KwaZulu-Natal', s: -31.2, w: 28.8, n: -26.7, e: 32.95 },
  { province: 'North West', s: -28.35, w: 22.5, n: -24.5, e: 28.05 },
  { province: 'Gauteng', s: -26.9, w: 27.3, n: -25.15, e: 28.75 },
  { province: 'Mpumalanga', s: -27.6, w: 28.9, n: -24.0, e: 32.2 },
  { province: 'Limpopo', s: -25.45, w: 26.45, n: -22.1, e: 31.95 },
];

function compactTags(tags: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!tags) return out;
  for (const key of TAG_KEEP) {
    const value = tags[key];
    if (value) out[key] = value;
  }
  return out;
}

function toSeed(element: OverpassElement): SeedRecord | null {
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  if (lat == null || lon == null) return null;
  const tags = compactTags(element.tags);
  if (!tags.shop && !tags.alcohol) return null;
  return { type: element.type, id: element.id, lat, lon, tags };
}

function keyOf(record: { type: string; id: number }): string {
  return `${record.type}-${record.id}`;
}

async function queryBox(
  box: (typeof EXTRACT_BOXES)[number],
  endpoint: string
): Promise<OverpassElement[]> {
  const query = `
[out:json][timeout:90];
(
  nwr["shop"="alcohol"](${box.s},${box.w},${box.n},${box.e});
  nwr["shop"="wine"](${box.s},${box.w},${box.n},${box.e});
  nwr["shop"]["alcohol"="yes"](${box.s},${box.w},${box.n},${box.e});
);
out center tags;
`.trim();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 95000);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'BoozeCompass/1.0 (poi-seed-expand; south-africa liquor retail)',
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = (await response.json()) as { elements?: OverpassElement[] };
    return body.elements ?? [];
  } finally {
    clearTimeout(timer);
  }
}

async function queryBoxWithRetry(box: (typeof EXTRACT_BOXES)[number]): Promise<OverpassElement[]> {
  let lastError: unknown;
  for (const endpoint of CONFIG.overpassEndpoints) {
    try {
      const elements = await queryBox(box, endpoint);
      console.log(`  ${box.province}: ${elements.length} elements from ${endpoint}`);
      return elements;
    } catch (err) {
      lastError = err;
      console.warn(`  ${box.province}: ${endpoint} failed (${err instanceof Error ? err.message : err})`);
    }
  }
  console.warn(`  ${box.province}: all endpoints failed — keeping existing rows, adding nothing from this box`);
  console.warn(lastError);
  return [];
}

function atomicWrite(filePath: string, contents: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  writeFileSync(tmp, contents);
  renameSync(tmp, filePath);
}

async function main() {
  const existing = JSON.parse(readFileSync(SEED_FILE, 'utf8')) as SeedRecord[];
  const originalIds = existing.map(keyOf);
  const seen = new Set(originalIds);
  const next = [...existing];
  const addedByProvince: Record<string, number> = Object.fromEntries(SA_PROVINCES.map((p) => [p, 0]));

  console.log(`Existing OSM seed: ${existing.length} (must all survive)`);

  for (const box of EXTRACT_BOXES) {
    const elements = await queryBoxWithRetry(box);
    for (const element of elements) {
      const record = toSeed(element);
      if (!record) continue;
      const key = keyOf(record);
      if (seen.has(key)) continue;
      seen.add(key);
      next.push(record);
      addedByProvince[box.province] += 1;
    }
  }

  const missing = originalIds.filter((id) => !seen.has(id));
  if (missing.length > 0) {
    throw new Error(`Refusing to write seed: lost ${missing.length} existing ids`);
  }
  if (next.length < existing.length) {
    throw new Error('Refusing to write a smaller seed');
  }

  atomicWrite(SEED_FILE, `${JSON.stringify(next)}\n`);
  console.log(`Wrote ${next.length} rows (was ${existing.length}, +${next.length - existing.length})`);
  console.log('Added by extract box:');
  for (const [province, count] of Object.entries(addedByProvince)) {
    console.log(`  ${province}: +${count}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
