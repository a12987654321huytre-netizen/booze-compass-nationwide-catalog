export type OsmTags = Record<string, string | undefined>;

export function resolveStoreName(tags: OsmTags): string {
  const name = tags.name || tags['name:en'] || tags.brand;
  if (name && name.trim().length > 0) return name.trim();
  return 'Liquor store';
}

export function resolveAddress(tags: OsmTags): string | undefined {
  const houseNumber = tags['addr:housenumber'];
  const street = tags['addr:street'];
  const suburb = tags['addr:suburb'];
  const city = tags['addr:city'];
  const streetLine = [houseNumber, street].filter(Boolean).join(' ');
  const parts = [streetLine, suburb, city].filter((part) => part && part.trim().length > 0);
  if (parts.length === 0) return undefined;
  return parts.join(', ');
}

export function collectNameFields(tags: OsmTags): { field: string; value: string }[] {
  const keys = ['name', 'name:en', 'official_name', 'brand', 'alt_name', 'short_name', 'operator'];
  const out: { field: string; value: string }[] = [];
  for (const field of keys) {
    const value = tags[field]?.trim();
    if (value) out.push({ field, value });
  }
  return out;
}
