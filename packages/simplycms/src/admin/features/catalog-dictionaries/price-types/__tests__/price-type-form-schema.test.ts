import { describe, expect, it } from 'vitest';
import { priceTypeFormSchema } from '../price-type-form-schema';

const ok = { name: 'Опт', code: 'wholesale_1', sortOrder: 0, isDefault: false };

describe('priceTypeFormSchema', () => {
  it('валідні значення проходять, sortOrder коерситься з рядка', () => {
    const r = priceTypeFormSchema.safeParse({ ...ok, sortOrder: '3' });
    expect(r.success && r.data.sortOrder).toBe(3);
  });
  it('code: кирилиця й дефіс відбиваються', () => {
    expect(
      priceTypeFormSchema.safeParse({ ...ok, code: 'оптова' }).success,
    ).toBe(false);
    expect(
      priceTypeFormSchema.safeParse({ ...ok, code: 'b2b-x' }).success,
    ).toBe(false);
  });
  it('порожня назва й відʼємний порядок відбиваються', () => {
    expect(priceTypeFormSchema.safeParse({ ...ok, name: '  ' }).success).toBe(
      false,
    );
    expect(
      priceTypeFormSchema.safeParse({ ...ok, sortOrder: -1 }).success,
    ).toBe(false);
  });
});
