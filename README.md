# Booze Compass — Nationwide Catalog

**Open. Point. Booze.**

A stupid-simple PWA that points you toward the nearest liquor store. Open
the app, allow location, and a giant compass arrow rotates to track the
nearest bottle store as you move and turn.

There is no map screen, no account, no dashboard. The arrow is the product.
The compass UX is unchanged: **user location → nearest accepted bottle
store → compass arrow / name / distance.**

This repository is a **brand-new** project. It is **not** a fork of, and
does **not** replace, the existing `boozecompass` repository.

---

## Nationwide catalog (the critical deliverable)

The app uses a locally bundled, **additive** POI catalog. Google Places was
used **offline for discovery / audit**, not as a paid runtime dependency.

| Layer | Path | Role |
|---|---|---|
| OSM seed | `src/data/osm-seed.json` | Original seed POIs (never deleted) |
| Curated corrections | `src/data/curatedPois.ts` | Known additions / renames / exclusions |
| Nationwide Google Places discoveries | `src/data/googlePlacesPois.json` | Additive observations already ingested |

`loadCatalog()` in `src/lib/poiCatalog.ts` merges these **additively**:

- External provider results never replace the catalog wholesale.
- Existing POIs remain unless there is an explicit record-specific deletion.
- Same-name / same-brand businesses at different physical locations stay separate.
- Deduplication only happens with enough evidence they are the same place.
- When uncertain, both records are kept.

Opening the app does **not** call Google Places. The browser never contains
the Google Places API key. Runtime lookup order:

1. Bundled catalog (seed + curated + nationwide Google discoveries)
2. Optional same-origin `/api/bottle-stores` refresh (EdgeOne; Overpass additive)
3. Never Google Places on app open

Catalog sizes at commit time:

- Google Places catalog (`src/data/googlePlacesPois.json`): **5616** POIs
- OSM seed: **112** POIs
- Curated additions: **4** POIs
- Combined catalog available to the app: **5732** POIs

---

## 1. Install dependencies

```bash
npm install
```

Requires Node 18+.

## 2. Run locally

```bash
npm run dev
```

Opens on `http://localhost:5173`. Your desktop browser almost certainly has
no GPS or compass hardware — use the **DEV** panel in the bottom-right
corner (only rendered in dev mode, never in production) to punch in a fake
latitude/longitude/heading and simulate movement/rotation.

## 3. Run tests

```bash
npm test
```

Regression coverage includes:

- additive POI integrity (`src/lib/__tests__/poiIntegrity.test.ts`)
- POI matching / dedup (`src/lib/__tests__/poiMatch.test.ts`)
- catalog loader (`src/lib/__tests__/poiCatalog.test.ts`)
- Google Places provider (script-only; no runtime key) (`src/lib/__tests__/googlePlacesProvider.test.ts`)
- nationwide geography / search grid (`src/lib/__tests__/saGeography.test.ts`)
- liquor-store classification / scoring
- discovery pipeline

## 4. Build

```bash
npm run build
```

Outputs a static site to `dist/`. Google Places is **not** called from the
browser bundle. The API key is never present.

## 5. EdgeOne `/api/bottle-stores`

`edge-functions/api/bottle-stores.ts` is the production API:

- Serves the bundled catalog first (`discoverLocal`)
- Overpass is an **additive** live refresh, never a wholesale replacement
- A thin / failed / zero-result Overpass response cannot delete catalog POIs
- The browser never talks to public Overpass mirrors (Safari CORS)
- Opening the app does not call Google Places

`edgeone.json` is included so EdgeOne rewrites continue to work.

---

## Discovery pipeline (offline / scripts only)

These scripts require a **server-side** `GOOGLE_PLACES_API_KEY`. They are
never invoked by the app.

```bash
# Nationwide Places audit (additive merge into googlePlacesPois.json)
GOOGLE_PLACES_API_KEY=... npm run audit:places

# Metro saturation pass
GOOGLE_PLACES_API_KEY=... npm run audit:metro
```

Key modules:

| File | Responsibility |
|---|---|
| `src/lib/discovery.ts` | Local catalog first, additive Overpass refresh |
| `src/lib/googlePlacesProvider.ts` | Script-only Places client (observations, not a snapshot) |
| `src/lib/poiMatch.ts` | Same-location matching; uncertain → keep both |
| `src/lib/poiIntegrity.ts` | Additive merge; absence is never deletion |
| `src/lib/poiCatalog.ts` | Seed + curated + Google discoveries loader |
| `src/lib/saGeography.ts` | SA provinces, nationwide search grid |
| `src/lib/liquorScoring.ts` / `liquorMatching.ts` | Bottle-store classification |
| `src/lib/seedProvider.ts` | OSM seed reader |
| `src/lib/curatedProvider.ts` | Curated additions / renames / exclusions |
| `src/data/googlePlacesPois.json` | Nationwide additive Google catalog |
| `src/data/osm-seed.json` | Original OSM seed |
| `src/data/curatedPois.ts` | Curated corrections |
| `edge-functions/api/bottle-stores.ts` | EdgeOne API |

Paid fallback (`src/lib/fallbackProvider.ts`) is **disabled by default**
and is a no-op without a server-side key.

---

## Architecture at a glance

```
src/
  data/
    osm-seed.json              original OSM seed (preserved)
    curatedPois.ts             curated additions / renames / exclusions
    googlePlacesPois.json      nationwide Google Places discoveries (5616)
  lib/
    poiCatalog.ts              additive catalog loader
    poiIntegrity.ts            non-destructive merge rules
    poiMatch.ts                same-physical-location matching
    googlePlacesProvider.ts    script-only discovery client
    saGeography.ts             nationwide geography / search grid
    discovery.ts               local catalog + additive Overpass
    liquorScoring.ts           bottle-store classifier
    apiProvider.ts             same-origin /api/bottle-stores client
    fallbackProvider.ts        paid fallback (disabled)
  hooks/
    useNearbyLiquorStores.ts   local catalog first, API refresh additive
  components/                  unchanged compass UX
edge-functions/api/bottle-stores.ts
scripts/
  google-places-audit.ts       nationwide discovery (script-only)
  metro-saturation.ts          metro densification (script-only)
  expand-osm-seed.ts
  debug-discovery.ts
```

## Design decisions

- **No interactive map.** The arrow is the product.
- **No accounts, no tracking, no stored location history.**
- **Google Places is discovery, not runtime.** The catalog is bundled.
- **Additive architecture.** Provider failure / zero / partial results
  never delete existing POIs.
