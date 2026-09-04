import { describe, it, expect } from 'vitest';
import { matchObservation, nameSimilarity, phonesMatch, shouldAddAsNewPoi } from '../poiMatch';

describe('nameSimilarity', () => {
  it('treats Checkers LiquorShop spelling variants as the same name', () => {
    expect(nameSimilarity('Checkers LiquorShop', 'LiquorShop Checkers')).toBeGreaterThan(0.5);
  });
});

describe('phonesMatch', () => {
  it('matches SA numbers on the last 9 digits', () => {
    expect(phonesMatch('+27 21 555 1234', '021 555 1234')).toBe(true);
    expect(phonesMatch('021 555 1234', '011 555 1234')).toBe(false);
  });
});

describe('matchObservation', () => {
  const stellenbosch = {
    id: 'vl-stb',
    name: 'Village Liquors',
    latitude: -33.92364,
    longitude: 18.8552,
    address: 'Stellenbosch',
  };

  it('CONFIRMED when coordinates and name agree', () => {
    const result = matchObservation(
      {
        id: 'g',
        name: 'Village Liquors',
        latitude: -33.9237,
        longitude: 18.85525,
      },
      [stellenbosch]
    );
    expect(result.class).toBe('MATCH_CONFIRMED');
    expect(result.existing?.id).toBe('vl-stb');
    expect(shouldAddAsNewPoi(result)).toBe(false);
  });

  it('CONFIRMED on shared Google Place ID even if the name drifted', () => {
    const result = matchObservation(
      {
        id: 'g',
        name: 'Village Liquor Store',
        latitude: -33.92,
        longitude: 18.86,
        googlePlaceId: 'ChIJabc',
      },
      [{ ...stellenbosch, googlePlaceId: 'ChIJabc' }]
    );
    expect(result.class).toBe('MATCH_CONFIRMED');
  });

  it('NEW_POI for the same brand in another city', () => {
    const result = matchObservation(
      {
        id: 'g',
        name: 'Village Liquors',
        latitude: -26.2041,
        longitude: 28.0473,
        address: 'Johannesburg',
      },
      [stellenbosch]
    );
    expect(result.class).toBe('NEW_POI');
    expect(shouldAddAsNewPoi(result)).toBe(true);
  });

  it('NEW_POI when nothing nearby exists', () => {
    const result = matchObservation(
      {
        id: 'g',
        name: 'House of Liquor',
        latitude: -23.886,
        longitude: 29.497,
      },
      [stellenbosch]
    );
    expect(result.class).toBe('NEW_POI');
  });

  it('does not confirm two different chains that merely share "Liquor"', () => {
    const result = matchObservation(
      {
        id: 'g',
        name: 'Pick n Pay Liquor',
        latitude: -33.924,
        longitude: 18.856,
      },
      [{ id: 'lc', name: 'Liquor City', latitude: -33.93395, longitude: 18.85917 }]
    );
    expect(result.class).not.toBe('MATCH_CONFIRMED');
  });
});
