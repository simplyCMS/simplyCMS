import { z } from 'zod';
import type { PlaceOrderInput } from 'simplycms/contracts';

/**
 * Схема оформлення — ЄДИНЕ джерело валідації запиту.
 *
 * 🔴 Живе окремим модулем без жодного серверного імпорту: її читає і
 * `inputValidator` серверної функції, і сама сторінка. Форма — контракт T0
 * `PlaceOrderInput`; `satisfies` не пропустить ані відсутнє поле, ані інший
 * тип, тож дзеркальних копій типу немає.
 *
 * Позиція кошика — ЛИШЕ ідентичність і кількість (К2-Е0, Е0-4): усе, що
 * приїхало б із кошика як «істина», можна підмінити в запиті (борг 0.4.1-4).
 */
export const checkoutItemSchema = z.object({
  productId: z.string().uuid(),
  modificationId: z.string().uuid().nullable(),
  quantity: z.number().int().positive(),
});

export const checkoutInputSchema = z.object({
  firstName: z.string().min(2).max(100),
  lastName: z.string().min(2).max(100),
  email: z.string().max(255),
  phone: z.string().max(50),
  shippingMethodId: z.string().uuid(),
  deliveryCity: z.string().nullable(),
  deliveryAddress: z.string().nullable(),
  pickupPointId: z.string().uuid().nullable(),
  paymentMethod: z.enum(['cash', 'online']),
  notes: z.string().max(5000).nullable(),
  hasDifferentRecipient: z.boolean(),
  recipientFirstName: z.string().nullable(),
  recipientLastName: z.string().nullable(),
  recipientPhone: z.string().nullable(),
  recipientEmail: z.string().nullable(),
  recipientCity: z.string().nullable(),
  recipientAddress: z.string().nullable(),
  recipientNotes: z.string().nullable(),
  saveRecipient: z.boolean(),
  savedRecipientId: z.string().uuid().nullable(),
  savedAddressId: z.string().uuid().nullable(),
  items: z.array(checkoutItemSchema).min(1),
}) satisfies z.ZodType<PlaceOrderInput>;
