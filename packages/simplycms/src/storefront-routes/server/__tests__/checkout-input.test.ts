import { describe, expect, it } from 'vitest';
import { checkoutInputSchema } from '../checkout-input';

const UUID = '11111111-1111-4111-8111-111111111111';

const valid = {
  firstName: 'Іван',
  lastName: 'Іваненко',
  email: '',
  phone: '',
  shippingMethodId: UUID,
  deliveryCity: 'Київ',
  deliveryAddress: null,
  pickupPointId: null,
  paymentMethod: 'cash',
  notes: null,
  hasDifferentRecipient: false,
  recipientFirstName: null,
  recipientLastName: null,
  recipientPhone: null,
  recipientEmail: null,
  recipientCity: null,
  recipientAddress: null,
  recipientNotes: null,
  saveRecipient: false,
  savedRecipientId: null,
  savedAddressId: null,
  items: [{ productId: UUID, modificationId: null, quantity: 1 }],
};

describe('checkoutInputSchema.paymentMethod (Е6а-3)', () => {
  it('приймає cash', () => {
    expect(checkoutInputSchema.safeParse(valid).success).toBe(true);
  });

  // Прямий POST не має класти в замовлення спосіб оплати, якого немає в UI.
  it('відхиляє online', () => {
    expect(
      checkoutInputSchema.safeParse({ ...valid, paymentMethod: 'online' })
        .success,
    ).toBe(false);
  });
});

// Межі кошика спільні для кошика, квоти й чекауту (Е6в-13, ред.2/ред.3):
// чекаут, що приймає більше за кошик, рахує те, чого покупець не бачив.
describe('checkoutInputSchema.items — межі кошика (Е6в-13)', () => {
  const item = (quantity: number, productId = UUID) => ({
    productId,
    modificationId: null,
    quantity,
  });
  const parse = (items: unknown[]) =>
    checkoutInputSchema.safeParse({ ...valid, items }).success;

  it('999 шт — так, 1000 — ні', () => {
    expect(parse([item(999)])).toBe(true);
    expect(parse([item(1000)])).toBe(false);
  });

  it('дубль пари (productId, modificationId) — помилка валідації', () => {
    expect(parse([item(1), item(2)])).toBe(false);
  });

  it('порожній кошик і 101 рядок — помилка', () => {
    const uuid = (i: number) =>
      `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
    expect(parse([])).toBe(false);
    expect(
      parse(Array.from({ length: 100 }, (_, i) => item(1, uuid(i + 1)))),
    ).toBe(true);
    expect(
      parse(Array.from({ length: 101 }, (_, i) => item(1, uuid(i + 1)))),
    ).toBe(false);
  });
});
