import { describe, it, expect } from 'vitest';
import { distanceQuip } from '../copy';

describe('distanceQuip - the 50-step distance ladder', () => {
  it('returns the first line at 0m', () => {
    expect(distanceQuip(0)).toBe('So close it would be embarrassing to drive.');
  });

  it('holds the line steady within a 500m band, then advances at the boundary', () => {
    expect(distanceQuip(0)).toBe(distanceQuip(499));
    expect(distanceQuip(500)).not.toBe(distanceQuip(499));
    expect(distanceQuip(500)).toBe('Just down the road.');
  });

  it('reaches the final line at exactly 24.5km', () => {
    expect(distanceQuip(24500)).toBe("That is a moerse trek. You're going to need snacks.");
  });

  it('reuses the final line for anything beyond 25km, all the way to the 50km search cap', () => {
    const finalLine = "That is a moerse trek. You're going to need snacks.";
    expect(distanceQuip(25000)).toBe(finalLine);
    expect(distanceQuip(30000)).toBe(finalLine);
    expect(distanceQuip(50000)).toBe(finalLine);
  });

  it('is deterministic - the same distance always returns the same line', () => {
    expect(distanceQuip(3200)).toBe(distanceQuip(3200));
  });

  it('escalates through all 50 distinct lines across the ladder, in order', () => {
    const seen: string[] = [];
    for (let band = 0; band < 50; band++) {
      seen.push(distanceQuip(band * 500));
    }
    expect(new Set(seen).size).toBe(50); // all distinct - a real narrative arc, not repeats
  });

  it('handles zero and negative input gracefully (never crashes, never goes out of range)', () => {
    expect(distanceQuip(0)).toBeTruthy();
    expect(distanceQuip(-100)).toBe(distanceQuip(0));
  });

  it('never returns anything that could read as encouraging drinking and driving', () => {
    const bannedPhrases = ['for the road', 'drink and drive', 'one for the drive'];
    for (let meters = 0; meters <= 30000; meters += 500) {
      const line = distanceQuip(meters).toLowerCase();
      for (const phrase of bannedPhrases) {
        expect(line).not.toContain(phrase);
      }
    }
  });
});
