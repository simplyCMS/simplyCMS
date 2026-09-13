import type { PlaceOrderInput } from 'simplycms/contracts';
import type { ActorDb } from './db';
import type { NewOrderInput, NewOrderItem } from './entities/new-order';
import { createRecipient } from './recipients';

/**
 * Отримувач і форма вставки для `placeOrderFor` — винесено в окремий модуль
 * лише заради канону 150 рядків на файл (як `escalation.ts` для `db.ts`):
 * сюди переїхали ДВІ дрібні чисті функції, а не самостійна відповідальність.
 */

/**
 * Отримувач замовлення: обраний зі списку, новий (зі збереженням) або жоден.
 *
 * Гість книги отримувачів не має — для нього завжди `null`.
 */
export async function resolveRecipient(
  db: ActorDb,
  userId: string | null,
  input: PlaceOrderInput,
): Promise<string | null> {
  if (input.savedRecipientId) return input.savedRecipientId;
  if (!userId || !input.hasDifferentRecipient || !input.saveRecipient) {
    return null;
  }
  if (!input.recipientFirstName || !input.recipientLastName) return null;
  if (!input.recipientPhone || !input.recipientCity) return null;
  if (!input.recipientAddress) return null;

  return createRecipient(db, userId, {
    firstName: input.recipientFirstName,
    lastName: input.recipientLastName,
    phone: input.recipientPhone,
    email: input.recipientEmail,
    city: input.recipientCity,
    address: input.recipientAddress,
    notes: input.recipientNotes,
  });
}

/**
 * Форма запиту → форма вставки.
 *
 * 🔴 Ціна позиції, сума й доставка приходять уже РАХОВАНІ сервером
 * (`priceCheckoutItems` + `resolveShippingRate`) — клієнтський запит цих
 * полів не несе взагалі, тож підмінити їх нізвідки. `total` — з
 * `PreparedCheckout.total` (рев'ю I1): рахує його ОДНЕ місце
 * (`prepareCheckout`), а не друга копія `subtotal + shippingCost` тут.
 * `methodCode` — з `PreparedCheckout.method.code` (рев'ю M-2): той самий
 * рядок, який `prepareCheckout` уже знайшов і провалідував на `is_active`,
 * тож `createOrder` більше не запитує його вдруге.
 */
export function toOrderInput(
  input: PlaceOrderInput,
  savedRecipientId: string | null,
  prepared: {
    items: NewOrderItem[];
    subtotal: number;
    shippingCost: number;
    total: number;
    methodCode: string;
  },
): NewOrderInput {
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    shippingMethodId: input.shippingMethodId,
    shippingMethodCode: prepared.methodCode,
    deliveryCity: input.deliveryCity,
    deliveryAddress: input.deliveryAddress,
    pickupPointId: input.pickupPointId,
    paymentMethod: input.paymentMethod,
    notes: input.notes,
    subtotal: prepared.subtotal,
    shippingCost: prepared.shippingCost,
    total: prepared.total,
    hasDifferentRecipient: input.hasDifferentRecipient,
    recipientFirstName: input.hasDifferentRecipient
      ? input.recipientFirstName
      : null,
    recipientLastName: input.hasDifferentRecipient
      ? input.recipientLastName
      : null,
    recipientPhone: input.hasDifferentRecipient ? input.recipientPhone : null,
    recipientEmail: input.hasDifferentRecipient ? input.recipientEmail : null,
    savedRecipientId,
    savedAddressId: input.savedAddressId,
    items: prepared.items,
  };
}
