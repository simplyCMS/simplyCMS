/**
 * Межі `saveStockInput`: бізнес-ліміт 1 000 000 шт. на точку відбивається
 * схемою (400 на межі serverFn), а не доходить до БД (500).
 */
import { describe, expect, it } from 'vitest';
import { saveStockInput } from '../stock/save';

const PRODUCT = '0e300000-0000-4000-8000-000000000011';
const POINT = '0e300000-0000-4000-8000-000000000012';
const parse = (quantity: number) =>
  saveStockInput.safeParse({
    productId: PRODUCT,
    modificationId: null,
    quantities: [{ pickupPointId: POINT, quantity }],
  }).success;

describe('saveStockInput: межі кількості', () => {
  it('0 і 1 000 000 приймаються', () => {
    expect(parse(0)).toBe(true);
    expect(parse(1_000_000)).toBe(true);
  });
  it('1 000 001, від’ємне і дробове відхиляються', () => {
    expect(parse(1_000_001)).toBe(false);
    expect(parse(-1)).toBe(false);
    expect(parse(1.5)).toBe(false);
  });
});
