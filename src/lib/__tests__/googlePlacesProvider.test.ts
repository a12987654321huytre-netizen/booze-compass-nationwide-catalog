import { describe, it, expect } from 'vitest';
import { isLikelyLiquorRetail, observationFromLegacyPlace } from '../googlePlacesProvider';

describe('isLikelyLiquorRetail', () => {
  it('accepts dedicated liquor stores', () => {
    expect(isLikelyLiquorRetail('Speedy Liquor Stores', ['liquor_store', 'store'])).toBe(true);
  });

  it('accepts known SA banners even if Google typed them loosely', () => {
    expect(isLikelyLiquorRetail('Checkers LiquorShop KBY Game Centre', ['store', 'point_of_interest'])).toBe(
      true
    );
  });

  it('rejects a restaurant that happens to list liquor_store', () => {
    expect(
      isLikelyLiquorRetail('café FRANK', ['restaurant', 'liquor_store', 'cafe', 'food'])
    ).toBe(false);
  });
});

describe('observationFromLegacyPlace', () => {
  it('drops permanently closed places', () => {
    const observation = observationFromLegacyPlace(
      {
        place_id: 'x',
        name: 'Old Bottle Store',
        geometry: { location: { lat: -26.2, lng: 28.04 } },
        types: ['liquor_store'],
        business_status: 'CLOSED_PERMANENTLY',
      },
      'q'
    );
    expect(observation).toBeNull();
  });

  it('drops results outside South Africa', () => {
    const observation = observationFromLegacyPlace(
      {
        place_id: 'x',
        name: 'Liquor Store',
        geometry: { location: { lat: 40.7, lng: -74.0 } },
        types: ['liquor_store'],
      },
      'q'
    );
    expect(observation).toBeNull();
  });

  it('keeps a Kimberley bottle store', () => {
    const observation = observationFromLegacyPlace(
      {
        place_id: 'ChIJ-kimberley',
        name: 'Royal Street Bottle Store',
        vicinity: 'Royal Street, Galeshewe, Kimberley',
        geometry: { location: { lat: -28.7256, lng: 24.7415 } },
        types: ['liquor_store', 'store', 'point_of_interest'],
      },
      'nc-kimberley'
    );
    expect(observation?.name).toBe('Royal Street Bottle Store');
    expect(observation?.province).toBe('Northern Cape');
  });

  it('drops a wine-route tourism listing even if Google typed liquor_store', () => {
    const observation = observationFromLegacyPlace(
      {
        place_id: 'ChIJ-wine-route',
        name: 'Wellington Wine Route',
        vicinity: 'Foreshore, Cape Town',
        geometry: { location: { lat: -33.922, lng: 18.441 } },
        types: ['liquor_store', 'point_of_interest'],
      },
      'wc-cape-town-cbd'
    );
    expect(observation).toBeNull();
  });
});
