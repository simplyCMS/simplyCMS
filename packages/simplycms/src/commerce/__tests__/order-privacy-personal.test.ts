// Реєстр ПД `orders` (Е6г-7): множина `personal` звіряється з НЕЗАЛЕЖНИМ
// переліком. Без нього помилкове пониження колонки до `operational` у самому
// реєстрі лишало б усі інші тести зеленими — вони читають той самий реєстр.
import { describe, expect, it } from 'vitest';
import { ORDER_COLUMN_PRIVACY } from '../order-privacy';

const EXPECTED_PERSONAL = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'deliveryAddress',
  'deliveryCity',
  'notes',
  'recipientFirstName',
  'recipientLastName',
  'recipientPhone',
  'recipientEmail',
  'userId',
  'savedAddressId',
  'savedRecipientId',
  'accessToken',
  'shippingData',
];

describe('реєстр ПД orders: перелік personal', () => {
  it('personal-колонки реєстру = явний перелік рішення Е6г-7', () => {
    const personal = Object.entries(ORDER_COLUMN_PRIVACY)
      .filter(([, kind]) => kind === 'personal')
      .map(([key]) => key)
      .sort();
    expect(personal).toEqual([...EXPECTED_PERSONAL].sort());
  });
});
