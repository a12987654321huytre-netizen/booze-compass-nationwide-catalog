import { describe, it, expect } from 'vitest';
import {
  getDistanceMeters,
  calculateBearing,
  normalizeAngle,
  shortestAngleDelta,
  stepTowardsAngle,
  smoothAngle,
  calculateArrowRotation,
  bearingToCompassPoint,
  formatDistance,
} from '../geo';

describe('getDistanceMeters', () => {
  it('returns 0 for identical points', () => {
    expect(getDistanceMeters(-33.9321, 18.8602, -33.9321, 18.8602)).toBe(0);
  });

  it('matches the known great-circle distance between Cape Town and Johannesburg (~1270 km)', () => {
    // Cape Town CBD -> Johannesburg CBD
    const meters = getDistanceMeters(-33.9249, 18.4241, -26.2041, 28.0473);
    const km = meters / 1000;
    expect(km).toBeGreaterThan(1260);
    expect(km).toBeLessThan(1280);
  });

  it('matches the known distance between London and Paris (~344 km)', () => {
    const meters = getDistanceMeters(51.5074, -0.1278, 48.8566, 2.3522);
    const km = meters / 1000;
    expect(km).toBeGreaterThan(340);
    expect(km).toBeLessThan(348);
  });

  it('is symmetric', () => {
    const a = getDistanceMeters(-33.9321, 18.8602, -33.9, 18.87);
    const b = getDistanceMeters(-33.9, 18.87, -33.9321, 18.8602);
    expect(a).toBeCloseTo(b, 6);
  });
});

describe('calculateBearing', () => {
  it('returns 0 (north) when destination is due north', () => {
    const bearing = calculateBearing(0, 0, 1, 0);
    expect(bearing).toBeCloseTo(0, 1);
  });

  it('returns 90 (east) when destination is due east on the equator', () => {
    const bearing = calculateBearing(0, 0, 0, 1);
    expect(bearing).toBeCloseTo(90, 1);
  });

  it('returns 180 (south) when destination is due south', () => {
    const bearing = calculateBearing(1, 0, 0, 0);
    expect(bearing).toBeCloseTo(180, 1);
  });

  it('returns 270 (west) when destination is due west on the equator', () => {
    const bearing = calculateBearing(0, 1, 0, 0);
    expect(bearing).toBeCloseTo(270, 1);
  });

  it('is always within [0, 360)', () => {
    const bearing = calculateBearing(-33.9321, 18.8602, -34.5, 19.5);
    expect(bearing).toBeGreaterThanOrEqual(0);
    expect(bearing).toBeLessThan(360);
  });
});

describe('normalizeAngle', () => {
  it('wraps values above 360', () => {
    expect(normalizeAngle(370)).toBe(10);
    expect(normalizeAngle(720)).toBe(0);
  });

  it('wraps negative values', () => {
    expect(normalizeAngle(-10)).toBe(350);
    expect(normalizeAngle(-370)).toBeCloseTo(350, 6);
  });

  it('leaves in-range values unchanged', () => {
    expect(normalizeAngle(180)).toBe(180);
    expect(normalizeAngle(0)).toBe(0);
  });
});

describe('shortestAngleDelta', () => {
  it('takes the short way across the 0/360 boundary instead of the long way', () => {
    // 359 -> 1 should be a short +2 degree step, not -358.
    expect(shortestAngleDelta(359, 1)).toBeCloseTo(2, 6);
    expect(shortestAngleDelta(1, 359)).toBeCloseTo(-2, 6);
  });

  it('returns 0 for equal angles', () => {
    expect(shortestAngleDelta(45, 45)).toBe(0);
  });

  it('handles the antipodal case as +/-180', () => {
    expect(Math.abs(shortestAngleDelta(0, 180))).toBe(180);
  });
});

describe('stepTowardsAngle', () => {
  it('does not overshoot the target', () => {
    const result = stepTowardsAngle(0, 5, 10);
    expect(result).toBeCloseTo(5, 6);
  });

  it('clamps to maxStep when the target is far away', () => {
    const result = stepTowardsAngle(0, 90, 10);
    expect(result).toBeCloseTo(10, 6);
  });

  it('steps forward through the 360/0 wrap rather than spinning backward', () => {
    // From 359 toward 1, the short path is forward (+2), so a 10-degree
    // step should land past the wrap, not go backward toward 180.
    const result = stepTowardsAngle(359, 1, 10);
    expect(result).toBeCloseTo(1, 6);
  });
});

describe('smoothAngle', () => {
  it('moves partway toward the target proportional to alpha', () => {
    const result = smoothAngle(0, 100, 0.5);
    expect(result).toBeCloseTo(50, 6);
  });

  it('does not spin the long way around the 359 -> 1 wrap', () => {
    const result = smoothAngle(359, 1, 0.5);
    // Shortest delta is +2, half of that is +1, landing at 0.
    expect(result).toBeCloseTo(0, 6);
  });
});

describe('calculateArrowRotation', () => {
  it('is 0 when device heading matches destination bearing exactly', () => {
    expect(calculateArrowRotation(90, 90)).toBe(0);
  });

  it('rotates the arrow left when the device has turned right of the destination', () => {
    // Facing 100 degrees, destination is at 90 -> arrow should point 10
    // degrees left (350, i.e. counter-clockwise) of straight ahead.
    expect(calculateArrowRotation(90, 100)).toBeCloseTo(350, 6);
  });

  it('never returns a negative or out-of-range value', () => {
    const result = calculateArrowRotation(10, 350);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThan(360);
  });
});

describe('bearingToCompassPoint', () => {
  it('maps cardinal directions correctly', () => {
    expect(bearingToCompassPoint(0)).toBe('north');
    expect(bearingToCompassPoint(90)).toBe('east');
    expect(bearingToCompassPoint(180)).toBe('south');
    expect(bearingToCompassPoint(270)).toBe('west');
  });

  it('maps an intercardinal direction correctly', () => {
    expect(bearingToCompassPoint(45)).toBe('northeast');
  });

  it('wraps 360 back to north', () => {
    expect(bearingToCompassPoint(360)).toBe('north');
  });
});

describe('formatDistance', () => {
  it('formats sub-kilometre distances in metres, rounded to 10m', () => {
    expect(formatDistance(620)).toBe('620 m');
    expect(formatDistance(847)).toBe('850 m');
    expect(formatDistance(4)).toBe('0 m');
  });

  it('formats kilometre distances with one decimal under 10km', () => {
    expect(formatDistance(2400)).toBe('2.4 km');
    expect(formatDistance(1000)).toBe('1.0 km');
  });

  it('formats large distances with no decimal at or above 10km', () => {
    expect(formatDistance(15000)).toBe('15 km');
  });

  it('never renders a raw multi-decimal float', () => {
    const result = formatDistance(847293);
    expect(result).not.toMatch(/\.\d{2,}/);
  });
});
