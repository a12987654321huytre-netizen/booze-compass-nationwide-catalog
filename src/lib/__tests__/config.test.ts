import { describe, it, expect } from 'vitest';
import { CONFIG } from '../config';

describe('CONFIG.searchRadiiMeters', () => {
  it('starts at 5km', () => {
    expect(CONFIG.searchRadiiMeters[0]).toBe(5000);
  });

  it('jumps to 10km on the first widen', () => {
    expect(CONFIG.searchRadiiMeters[1]).toBe(10000);
  });

  it('climbs in 5km increments after the initial jump', () => {
    for (let i = 1; i < CONFIG.searchRadiiMeters.length - 1; i++) {
      expect(CONFIG.searchRadiiMeters[i + 1] - CONFIG.searchRadiiMeters[i]).toBe(5000);
    }
  });

  it('is capped at 50km', () => {
    expect(CONFIG.searchRadiiMeters[CONFIG.searchRadiiMeters.length - 1]).toBe(50000);
    expect(Math.max(...CONFIG.searchRadiiMeters)).toBe(50000);
  });

  it('is strictly increasing with no duplicates', () => {
    for (let i = 1; i < CONFIG.searchRadiiMeters.length; i++) {
      expect(CONFIG.searchRadiiMeters[i]).toBeGreaterThan(CONFIG.searchRadiiMeters[i - 1]);
    }
  });
});
