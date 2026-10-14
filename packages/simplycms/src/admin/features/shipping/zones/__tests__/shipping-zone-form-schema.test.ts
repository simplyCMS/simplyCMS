import { describe, expect, it } from 'vitest';
import { shippingZoneFormSchema } from '../shipping-zone-form-schema';

describe('shippingZoneFormSchema', () => {
  const ok = {
    name: 'Київ',
    description: '',
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
