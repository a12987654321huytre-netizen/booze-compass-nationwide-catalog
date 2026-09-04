/**
 * Debug tool for liquor-store discovery.
 *
 * Prints every raw OSM candidate Overpass returns near a point, its
 * tags, its computed confidence score, and why it was accepted or
 * rejected. Never shipped in the app itself - run it directly with
 * Node during development to sanity-check coverage in a new area.
 *
 * Usage:
 *   npm run debug:discovery -- [lat] [lon] [radiusMeters]
 *
 * Defaults to a point in central Stellenbosch. Pass the real
 * coordinates of whatever you're checking (e.g. right outside the
 * Shoprite on the corner you're investigating) for a meaningful result:
 *
 *   npm run debug:discovery -- -33.9346 18.8601 800
 */
import { OverpassLiquorStoreProvider } from '../src/lib/overpassProvider';
import { LIQUOR_CONFIDENCE_THRESHOLD } from '../src/lib/liquorScoring';

const DEFAULT_LAT = -33.9321; // central Stellenbosch - adjust to your real target
const DEFAULT_LON = 18.8602;
const DEFAULT_RADIUS = 1000;

async function main() {
  const [latArg, lonArg, radiusArg] = process.argv.slice(2);
  const lat = latArg ? parseFloat(latArg) : DEFAULT_LAT;
  const lon = lonArg ? parseFloat(lonArg) : DEFAULT_LON;
  const radius = radiusArg ? parseFloat(radiusArg) : DEFAULT_RADIUS;

  console.log(`\nQuerying Overpass around (${lat}, ${lon}) within ${radius}m...\n`);

  const provider = new OverpassLiquorStoreProvider();
  let candidates;
  try {
    candidates = await provider.findNearbyDebug(lat, lon, radius);
  } catch (err) {
    console.error('Overpass query failed:', err instanceof Error ? err.message : err);
    console.error(
      '\nNote: this needs real internet access to a public Overpass endpoint.'
    );
    process.exitCode = 1;
    return;
  }

  if (candidates.length === 0) {
    console.log('No candidates of any kind found in range (nothing tagged as a shop,');
    console.log('nothing whose name matched the liquor regex). Try a wider radius.');
    return;
  }

  const accepted = candidates.filter((c) => c.score.accepted);
  const rejected = candidates.filter((c) => !c.score.accepted);

  console.log(`${candidates.length} raw candidate(s) inspected.`);
  console.log(`${accepted.length} ACCEPTED (score >= ${LIQUOR_CONFIDENCE_THRESHOLD}).`);
  console.log(`${rejected.length} rejected.\n`);
  console.log('='.repeat(72));

  for (const candidate of candidates) {
    const verdict = candidate.score.accepted ? 'ACCEPTED' : 'rejected';
    console.log(`\n[${verdict}] ${candidate.name}  (score: ${candidate.score.score})`);
    console.log(`  id:       ${candidate.id}`);
    console.log(`  location: ${candidate.latitude.toFixed(5)}, ${candidate.longitude.toFixed(5)}`);
    console.log(`  tags:     ${JSON.stringify(candidate.rawTags)}`);
    console.log(`  reasons:`);
    for (const reason of candidate.score.reasons) {
      console.log(`    - ${reason.signal} (${reason.score})`);
    }
  }

  console.log(`\n${'='.repeat(72)}`);
  console.log('\nAccepted stores (what the app would actually show):\n');
  if (accepted.length === 0) {
    console.log('  (none)');
  } else {
    for (const candidate of accepted) {
      console.log(`  - ${candidate.name} (score ${candidate.score.score})`);
    }
  }
  console.log('');
}

main();
