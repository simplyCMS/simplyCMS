import { z } from 'zod';
import type { PlaceOrderInput } from 'simplycms/contracts';

/**
 * Схема оформлення — ЄДИНЕ джерело валідації запиту НА СЕРВЕРІ.
 *
 * 🔴 Живе окремим модулем без жодного серверного імпорту, але читає її ЛИШЕ
 * `inputValidator` серверної функції (`storefront-routes/server/checkout.ts`)
 * — рев'ю M1 звірило факт: сторінка (`Checkout.tsx`) цю схему НЕ імпортує,
 * вона валідує форму власною `buildCheckoutSchema` із менш строгими
 * правилами (напр. `savedAddressId` там `z.string().optional()`, тут
 * `.uuid().nullable()`). Розходження двох схем не спливе помилкою поля у
 * формі — воно впаде сирим текстом винятку `inputValidator` в тості
 * `checkout.failed`/`checkout.retry` (борг, не ця задача).
 *
 * Форма — контракт T0 `PlaceOrderInput`; `satisfies` гарантує, що в об'єкті
 * ЄСТЬ усі поля контракту з правильним ТИПОМ (пропустити чи змінити тип
 * поля не вийде), але не захищає від ЗАЙВОГО поля схеми (`ZodType`
 * коваріантний по Output) — цю межу тримає сам контракт T0, у якому
 * цінових полів немає фізично, і `z.object`, який зрізає невідомі ключі на
 * парсингу.
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
