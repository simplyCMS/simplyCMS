import { z } from 'zod';
import type { JsonValue } from 'simplycms/storefront/loaders';

/**
 * Схема оформлення — ЄДИНЕ джерело форми запиту.
 *
 * 🔴 Живе окремим модулем без жодного серверного імпорту: її читає і
 * `inputValidator` серверної функції, і сама сторінка (щоб типи форми й
 * запиту не розʼїхались). Тримати її поруч із хендлером не можна — модуль
 * із живим експортом затягнув би серверний контур у клієнтський бандл.
 */
export const checkoutItemSchema = z.object({
  productId: z.string().uuid().nullable(),
  modificationId: z.string().uuid().nullable(),
  name: z.string().min(1),
  price: z.number().nonnegative(),
  quantity: z.number().int().positive(),
  basePrice: z.number().nonnegative().nullable(),
  /**
   * 🔴 `jsonb` без форми: рушій знижок кладе сюди власну структуру. Валідувати
   * її схемою означало б продублювати домен у контракті запиту, тож тут лише
   * звуження типу — а зміст перевіряє той, хто його читає.
   */
  discountData: z
    .unknown()
    .transform(
      (value): JsonValue | null => (value ?? null) as JsonValue | null,
    ),
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
  shippingCost: z.number().nonnegative(),
  hasDifferentRecipient: z.boolean(),
  recipientFirstName: z.string().nullable(),
  recipientLastName: z.string().nullable(),
  recipientPhone: z.string().nullable(),
  recipientEmail: z.string().nullable(),
  recipientCity: z.string().nullable(),
  recipientAddress: z.string().nullable(),
  recipientNotes: z.string().nullable(),
  /** Зберегти нового отримувача в книгу покупця. */
  saveRecipient: z.boolean(),
  /** Обраний зі списку отримувач; `null` — новий або без отримувача. */
  savedRecipientId: z.string().uuid().nullable(),
  savedAddressId: z.string().uuid().nullable(),
  items: z.array(checkoutItemSchema).min(1),
});

export type CheckoutInput = z.infer<typeof checkoutInputSchema>;

/** Що повертається сторінці після успішного оформлення. */
export interface PlacedOrder {
  id: string;
  orderNumber: string;
  /** Токен гостьового замовлення; для залогіненого — `null`. */
  accessToken: string | null;
}
