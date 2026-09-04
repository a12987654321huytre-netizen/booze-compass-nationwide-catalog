import { describe, it, expect } from 'vitest';
import {
  SA_PROVINCES,
  SA_SEARCH_GRID,
  isInSouthAfrica,
  provinceFromCoordinates,
  provincesCoveredByGrid,
  resolveProvince,
} from '../saGeography';

describe('saGeography', () => {
  it('covers every province in the search grid', () => {
    expect(provincesCoveredByGrid()).toEqual([...SA_PROVINCES]);
  });

  it('does not treat Cape Town as the whole country', () => {
    const capeTownish = SA_SEARCH_GRID.filter(
      (p) => p.province === 'Western Cape' && /cape town|sea point|claremont|bellville|khayelitsha|mitchells|table view/i.test(p.name)
    );
    const otherProvinces = SA_SEARCH_GRID.filter((p) => p.province !== 'Western Cape');
    expect(otherProvinces.length).toBeGreaterThan(capeTownish.length);
  });

  it('classifies well-known cities into the right province', () => {
    expect(provinceFromCoordinates(-33.9249, 18.4241)).toBe('Western Cape');
    expect(provinceFromCoordinates(-33.9608, 25.6022)).toBe('Eastern Cape');
    expect(provinceFromCoordinates(-28.7282, 24.7499)).toBe('Northern Cape');
    expect(provinceFromCoordinates(-29.0852, 26.1596)).toBe('Free State');
    expect(provinceFromCoordinates(-29.8587, 31.0218)).toBe('KwaZulu-Natal');
    expect(provinceFromCoordinates(-25.667, 27.242)).toBe('North West');
    expect(provinceFromCoordinates(-26.2041, 28.0473)).toBe('Gauteng');
    expect(provinceFromCoordinates(-25.465, 30.985)).toBe('Mpumalanga');
    expect(provinceFromCoordinates(-23.9045, 29.4689)).toBe('Limpopo');
  });

  it('does not let Free State swallow Kimberley or KZN swallow Harrismith', () => {
    expect(provinceFromCoordinates(-28.7282, 24.7499)).toBe('Northern Cape'); // Kimberley
    expect(provinceFromCoordinates(-30.65, 24.012)).toBe('Northern Cape'); // De Aar
    expect(provinceFromCoordinates(-27.452, 23.432)).toBe('Northern Cape'); // Kuruman
    expect(provinceFromCoordinates(-28.273, 29.129)).toBe('Free State'); // Harrismith
    expect(provinceFromCoordinates(-30.695, 26.711)).toBe('Eastern Cape'); // Aliwal North
    expect(provinceFromCoordinates(-25.634, 27.78)).toBe('North West'); // Brits
    expect(provinceFromCoordinates(-26.852, 26.666)).toBe('North West'); // Klerksdorp
    expect(provinceFromCoordinates(-26.715, 27.096)).toBe('North West'); // Potchefstroom
    expect(provinceFromCoordinates(-26.813, 27.824)).toBe('Free State'); // Sasolburg

    expect(provinceFromCoordinates(-34.052, 23.368)).toBe('Western Cape'); // Plettenberg Bay
    expect(provinceFromCoordinates(-25.044, 31.126)).toBe('Mpumalanga'); // Hazyview
    expect(provinceFromCoordinates(-25.332, 31.012)).toBe('Mpumalanga'); // White River
    expect(provinceFromCoordinates(-24.347, 30.95)).toBe('Limpopo'); // Hoedspruit
  });

  it('prefers address province text when present', () => {
    expect(resolveProvince(-26.2, 28.04, 'Sandton, Gauteng, South Africa')).toBe('Gauteng');
    expect(resolveProvince(-23.9, 29.45, 'Polokwane, Limpopo')).toBe('Limpopo');
  });

  it('rejects coordinates outside South Africa', () => {
    expect(isInSouthAfrica(51.5, -0.12)).toBe(false);
    expect(isInSouthAfrica(-26.2, 28.04)).toBe(true);
  });
});
