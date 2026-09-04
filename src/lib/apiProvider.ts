import type { LiquorStore, LiquorStoreProvider } from '../types/store';

type BottleStoresSuccessResponse = { stores: LiquorStore[] };

/**
 * Same-origin API. The browser never talks to Overpass or Google Places.
 * Catalog lookup happens locally first; this refresh is additive.
 */
export class ApiLiquorStoreProvider implements LiquorStoreProvider {
  async findNearby(
    latitude: number,
    longitude: number,
    radiusMeters: number
  ): Promise<LiquorStore[]> {
    const params = new URLSearchParams({
      lat: String(latitude),
      lon: String(longitude),
      radius: String(radiusMeters),
    });

    const response = await fetch(`/api/bottle-stores?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`bottle-stores request failed with status ${response.status}`);
    }

    const data = (await response.json()) as BottleStoresSuccessResponse;
    return data.stores;
  }
}
