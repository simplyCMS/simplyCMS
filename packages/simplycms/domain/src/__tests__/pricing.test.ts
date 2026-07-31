import { describe, it, expect } from 'vitest';
import { resolvePrice } from '../pricing';
import type { PriceEntry } from '../pricing';

const prices: PriceEntry[] = [
  {
    price_type_id: 'retail',
    price: 100,
    old_price: 120,
    modification_id: null,
  },
  {
    price_type_id: 'wholesale',
    price: 80,
    old_price: null,
    modification_id: null,
  },
  {
    price_type_id: 'retail',
    price: 50,
    old_price: 60,
    modification_id: 'mod-1',
  },
];

describe('resolvePrice', () => {
  it('returns null for empty prices', () => {
    expect(resolvePrice([], 'retail', 'retail')).toEqual({
      price: null,
      oldPrice: null,
    });
  });

  it('picks the requested price type', () => {
    expect(resolvePrice(prices, 'wholesale', 'retail')).toEqual({
      price: 80,
      oldPrice: null,
    });
  });

  it('falls back to default price type when requested is missing', () => {
    expect(resolvePrice(prices, 'unknown', 'retail')).toEqual({
      price: 100,
      oldPrice: 120,
    });
  });

  it('matches modification-specific price', () => {
    expect(resolvePrice(prices, 'retail', 'retail', 'mod-1')).toEqual({
      price: 50,
      oldPrice: 60,
    });
  });

  it('returns null when no price type matches', () => {
    expect(resolvePrice(prices, 'x', 'y')).toEqual({
      price: null,
      oldPrice: null,
    });
  });
});
