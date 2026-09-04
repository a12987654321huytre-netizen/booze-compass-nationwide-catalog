/**
 * Google Places (legacy) discovery client.
 *
 * Observations only. Never a catalog replacement. Callers must merge
 * through applyAdditiveInserts / matchObservation. Failure modes are
 * explicit source states so ZERO_RESULTS cannot be mistaken for
 * "there are no bottle stores here".
 *
 * Uses the legacy Places API because Places API (New) is not enabled
 * on the supplied project. Server / script only — the API key must
 * never ship to the browser.
 */

import { scoreLiquorCandidate } from './liquorScoring';
import { matchesGenericLiquorKeyword, matchesKnownBrand } from './liquorMatching';
import { isInSouthAfrica, resolveProvince, type SAProvince } from './saGeography';
import type { ProviderSourceState } from './poiIntegrity';

const LEGACY_NEARBY = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
const LEGACY_TEXT = 'https://maps.googleapis.com/maps/api/place/textsearch/json';

const DINING_TYPES = new Set(['restaurant', 'bar', 'cafe', 'night_club', 'meal_takeaway', 'bakery']);

export type GooglePlaceObservation = {
  googlePlaceId: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  phone?: string;
  types: string[];
  rating?: number;
  businessStatus?: string;
  openingHours?: string;
  website?: string;
  province?: SAProvince;
  queryId: string;
};

export type GoogleQueryResult = {
  queryId: string;
  query: string;
  state: ProviderSourceState;
  observations: GooglePlaceObservation[];
  error?: string;
  nextPageAvailable: boolean;
  rawResultCount: number;
  pages: number;
};

export type GooglePlacesConfig = {
  apiKey: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

type LegacyPlace = {
  place_id?: string;
  name?: string;
  vicinity?: string;
  formatted_address?: string;
  geometry?: { location?: { lat?: number; lng?: number } };
  types?: string[];
  rating?: number;
  business_status?: string;
  international_phone_number?: string;
  formatted_phone_number?: string;
  opening_hours?: { open_now?: boolean; weekday_text?: string[] };
  website?: string;
};

type LegacyResponse = {
  status?: string;
  error_message?: string;
  results?: LegacyPlace[];
  next_page_token?: string;
};

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function statusToState(status: string | undefined, resultCount: number, hasNext: boolean): ProviderSourceState {
  switch (status) {
    case 'OK':
      return hasNext ? 'SOURCE_PARTIAL_RESULTS' : 'SOURCE_SUCCESS';
    case 'ZERO_RESULTS':
      return 'SOURCE_ZERO_RESULTS';
    case 'OVER_QUERY_LIMIT':
    case 'REQUEST_DENIED':
      return 'SOURCE_UNAVAILABLE';
    case 'INVALID_REQUEST':
      return 'SOURCE_FAILED';
    case 'UNKNOWN_ERROR':
      return 'SOURCE_FAILED';
    default:
      if (resultCount === 0) return 'SOURCE_FAILED';
      return 'SOURCE_PARTIAL_RESULTS';
  }
}

function isDedicatedLiquorType(types: string[]): boolean {
  if (!types.includes('liquor_store')) return false;
  return !types.some((type) => DINING_TYPES.has(type));
}

/**
 * Google tags some restaurants as liquor_store. We only keep genuine
 * alcohol retail: dedicated liquor_store type, or a name that is
 * recognisably a bottle store / known SA liquor brand.
 */
export function isLikelyLiquorRetail(name: string, types: string[]): boolean {
  if (matchesKnownBrand(name) || matchesGenericLiquorKeyword(name)) return true;
  if (isDedicatedLiquorType(types)) return true;
  return false;
}

export function observationFromLegacyPlace(
  place: LegacyPlace,
  queryId: string
): GooglePlaceObservation | null {
  const placeId = place.place_id;
  const name = place.name?.trim();
  const lat = place.geometry?.location?.lat;
  const lng = place.geometry?.location?.lng;
  if (!placeId || !name || lat == null || lng == null) return null;
  if (!isInSouthAfrica(lat, lng)) return null;
  if (place.business_status === 'CLOSED_PERMANENTLY') return null;

  const types = place.types ?? [];
  if (!isLikelyLiquorRetail(name, types)) return null;

  const tags = {
    name,
    shop: isDedicatedLiquorType(types) ? 'alcohol' : undefined,
  };
  const score = scoreLiquorCandidate(tags, name);
  if (!score.accepted) return null;

  const address = place.formatted_address || place.vicinity;
  const openingHours = place.opening_hours?.weekday_text?.join('; ');

  return {
    googlePlaceId: placeId,
    name,
    latitude: lat,
    longitude: lng,
    address,
    phone: place.international_phone_number || place.formatted_phone_number,
    types,
    rating: place.rating,
    businessStatus: place.business_status,
    openingHours,
    website: place.website,
    province: resolveProvince(lat, lng, address),
    queryId,
  };
}

async function fetchLegacy(
  url: string,
  config: GooglePlacesConfig
): Promise<{ state: ProviderSourceState; body: LegacyResponse; error?: string }> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    if (!response.ok) {
      return {
        state: response.status === 429 ? 'SOURCE_UNAVAILABLE' : 'SOURCE_FAILED',
        body: {},
        error: `HTTP ${response.status}`,
      };
    }
    const body = (await response.json()) as LegacyResponse;
    const results = body.results ?? [];
    const state = statusToState(body.status, results.length, Boolean(body.next_page_token));
    return { state, body, error: body.error_message };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Places request failed';
    const timedOut = message.toLowerCase().includes('abort');
    return { state: timedOut ? 'SOURCE_TIMEOUT' : 'SOURCE_FAILED', body: {}, error: message };
  } finally {
    clearTimeout(timeout);
  }
}

function buildQueryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  return search.toString();
}

export async function nearbyLiquorSearch(
  input: {
    queryId: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
    paginate?: boolean;
  },
  config: GooglePlacesConfig
): Promise<GoogleQueryResult> {
  const sleep = config.sleep ?? defaultSleep;
  const observations: GooglePlaceObservation[] = [];
  let pageToken: string | undefined;
  let lastState: ProviderSourceState = 'SOURCE_FAILED';
  let error: string | undefined;
  let pages = 0;
  let rawResultCount = 0;
  const maxPages = input.paginate === false ? 1 : 3;

  do {
    if (pageToken) await sleep(2500);
    const url = `${LEGACY_NEARBY}?${buildQueryString({
      location: `${input.latitude},${input.longitude}`,
      radius: Math.min(Math.max(input.radiusMeters, 200), 50000),
      type: 'liquor_store',
      key: config.apiKey,
      pagetoken: pageToken,
    })}`;
    const { state, body, error: requestError } = await fetchLegacy(url, config);
    lastState = state;
    error = requestError;
    pages += 1;
    rawResultCount += (body.results ?? []).length;
    for (const place of body.results ?? []) {
      const observation = observationFromLegacyPlace(place, input.queryId);
      if (observation) observations.push(observation);
    }
    pageToken = body.next_page_token;
    if (
      state === 'SOURCE_FAILED' ||
      state === 'SOURCE_TIMEOUT' ||
      state === 'SOURCE_UNAVAILABLE'
    ) {
      break;
    }
  } while (pageToken && pages < maxPages);

  const hadCap = pages >= maxPages && Boolean(pageToken);
  return {
    queryId: input.queryId,
    query: `nearby liquor_store ${input.latitude},${input.longitude} r=${input.radiusMeters}`,
    state:
      lastState === 'SOURCE_SUCCESS' && hadCap
        ? 'SOURCE_PARTIAL_RESULTS'
        : observations.length === 0
          ? lastState
          : hadCap
            ? 'SOURCE_PARTIAL_RESULTS'
            : lastState === 'SOURCE_ZERO_RESULTS'
              ? 'SOURCE_SUCCESS'
              : lastState,
    observations,
    error,
    nextPageAvailable: Boolean(pageToken) && pages >= maxPages,
    rawResultCount,
    pages,
  };
}

export async function textLiquorSearch(
  input: {
    queryId: string;
    textQuery: string;
    latitude?: number;
    longitude?: number;
    radiusMeters?: number;
    paginate?: boolean;
  },
  config: GooglePlacesConfig
): Promise<GoogleQueryResult> {
  const sleep = config.sleep ?? defaultSleep;
  const observations: GooglePlaceObservation[] = [];
  let pageToken: string | undefined;
  let lastState: ProviderSourceState = 'SOURCE_FAILED';
  let error: string | undefined;
  let pages = 0;
  let rawResultCount = 0;
  const maxPages = input.paginate === false ? 1 : 3;

  do {
    if (pageToken) await sleep(2500);
    const url = `${LEGACY_TEXT}?${buildQueryString({
      query: input.textQuery,
      location:
        input.latitude != null && input.longitude != null
          ? `${input.latitude},${input.longitude}`
          : undefined,
      radius: input.radiusMeters,
      key: config.apiKey,
      pagetoken: pageToken,
    })}`;
    const { state, body, error: requestError } = await fetchLegacy(url, config);
    lastState = state;
    error = requestError;
    pages += 1;
    rawResultCount += (body.results ?? []).length;
    for (const place of body.results ?? []) {
      const observation = observationFromLegacyPlace(place, input.queryId);
      if (observation) observations.push(observation);
    }
    pageToken = body.next_page_token;
    if (
      state === 'SOURCE_FAILED' ||
      state === 'SOURCE_TIMEOUT' ||
      state === 'SOURCE_UNAVAILABLE'
    ) {
      break;
    }
  } while (pageToken && pages < maxPages);

  const hadCap = pages >= maxPages && Boolean(pageToken);
  return {
    queryId: input.queryId,
    query: input.textQuery,
    state:
      lastState === 'SOURCE_SUCCESS' && hadCap
        ? 'SOURCE_PARTIAL_RESULTS'
        : observations.length === 0
          ? lastState
          : hadCap
            ? 'SOURCE_PARTIAL_RESULTS'
            : lastState === 'SOURCE_ZERO_RESULTS'
              ? 'SOURCE_SUCCESS'
              : lastState,
    observations,
    error,
    nextPageAvailable: Boolean(pageToken) && pages >= maxPages,
    rawResultCount,
    pages,
  };
}

export function dedupeObservations(
  observations: GooglePlaceObservation[]
): GooglePlaceObservation[] {
  const seen = new Set<string>();
  const out: GooglePlaceObservation[] = [];
  for (const observation of observations) {
    if (seen.has(observation.googlePlaceId)) continue;
    seen.add(observation.googlePlaceId);
    out.push(observation);
  }
  return out;
}
