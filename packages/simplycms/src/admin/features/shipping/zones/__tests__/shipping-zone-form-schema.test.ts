import { describe, expect, it } from 'vitest';
import {
  joinList,
  shippingZoneFormSchema,
  splitList,
} from '../shipping-zone-form-schema';

describe('списки міст і областей', () => {
  it('splitList: кома й новий рядок, обрізка, порожні відкидаються', () => {
    expect(splitList(' Київ, Бровари\nІрпінь ,, ')).toEqual([
      'Київ',
      'Бровари',
      'Ірпінь',
    ]);
    expect(splitList('')).toEqual([]);
  });
  it('joinList — зворотна операція, null → порожній рядок', () => {
    expect(joinList(['Київ', 'Бровари'])).toBe('Київ, Бровари');
    expect(joinList(null)).toBe('');
  });
});

describe('shippingZoneFormSchema', () => {
  const ok = {
    name: 'Київ',
    description: '',
    cities: '',
    regions: '',
    sortOrder: '3',
    isActive: true,
  };
  it('приймає валідні значення, sortOrder приводиться до числа', () => {
    expect(shippingZoneFormSchema.parse(ok).sortOrder).toBe(3);
  });
  it('порожня назва — помилка', () => {
    expect(shippingZoneFormSchema.safeParse({ ...ok, name: ' ' }).success).toBe(
      false,
    );
  });
});
