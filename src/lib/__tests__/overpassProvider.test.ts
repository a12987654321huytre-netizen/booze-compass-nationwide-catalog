import { describe, it, expect } from 'vitest';
import { buildQuery } from '../overpassProvider';

describe('buildQuery - regression guard against unscoped name-regex scans', () => {
  // A name-regex query with no tag constraint at all (`nwr["name"~...]`)
  // asks Overpass to scan every named element near the point - roads,
  // bus stops, buildings, everything - against a 1000+ character regex.
  // The name-regex clause must always be scoped to elements that already
  // carry a shop tag. Matching runs across name/brand/alt_name keys.
  it('scopes the name-regex query to elements with a shop tag', () => {
    const query = buildQuery(-33.9321, 18.8602, 5000);
    expect(query).toContain('nwr["shop"][~"');
    expect(query).toContain('^(name|name:en|brand|official_name|alt_name|short_name)$');
  });

  it('never emits an unscoped nwr[name~...] query with no other tag filter', () => {
    const query = buildQuery(-33.9321, 18.8602, 5000);
    const lines = query.split('\n').filter((line) => /name~|name:en|alt_name/.test(line) && line.includes('~"'));
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line).toContain('["shop"]');
    }
  });

  it('still includes the explicit shop=alcohol/wine/beverages tag queries', () => {
    const query = buildQuery(-33.9321, 18.8602, 5000);
    expect(query).toContain('"shop"="alcohol"');
    expect(query).toContain('"shop"="wine"');
    expect(query).toContain('"shop"="beverages"');
  });

  it('produces valid, non-empty Overpass QL with the radius embedded', () => {
    const query = buildQuery(-33.9321, 18.8602, 12345);
    expect(query).toContain('around:12345,-33.9321,18.8602');
    expect(query.length).toBeGreaterThan(0);
  });
});
