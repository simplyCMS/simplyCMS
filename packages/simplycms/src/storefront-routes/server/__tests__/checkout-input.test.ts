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
