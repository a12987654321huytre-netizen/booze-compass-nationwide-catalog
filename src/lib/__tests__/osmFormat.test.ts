import { describe, it, expect } from 'vitest';
import { resolveStoreName, resolveAddress } from '../osmFormat';

describe('resolveStoreName', () => {
  it('uses the name tag when present', () => {
    expect(resolveStoreName({ name: 'TOPS at SPAR Stellenbosch' })).toBe(
      'TOPS at SPAR Stellenbosch'
    );
  });

  it('falls back to brand when name is missing', () => {
    expect(resolveStoreName({ brand: 'Ultra Liquors' })).toBe('Ultra Liquors');
  });

  it('falls back to a tasteful generic label when nothing is available', () => {
    expect(resolveStoreName({})).toBe('Liquor store');
  });

  it('never surfaces an empty or whitespace-only name', () => {
    expect(resolveStoreName({ name: '   ' })).toBe('Liquor store');
  });
});

describe('resolveAddress', () => {
  it('combines house number, street, suburb, and city into one line', () => {
    expect(
      resolveAddress({
        'addr:housenumber': '12',
        'addr:street': 'Main Street',
        'addr:suburb': 'Stellenbosch Central',
        'addr:city': 'Stellenbosch',
      })
    ).toBe('12 Main Street, Stellenbosch Central, Stellenbosch');
  });

  it('omits missing parts without leaving stray commas', () => {
    expect(resolveAddress({ 'addr:street': 'Main Street', 'addr:city': 'Cape Town' })).toBe(
      'Main Street, Cape Town'
    );
  });

  it('returns undefined when no address tags exist at all', () => {
    expect(resolveAddress({})).toBeUndefined();
  });
});
