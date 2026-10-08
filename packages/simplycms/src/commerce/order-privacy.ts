import { eq, sql, type SQL } from 'drizzle-orm';
import type { ActorDb } from 'simplycms/db';
import { orders } from 'simplycms/schema';
import type { Order } from 'simplycms/schema/types';

/** `personal` — персональні дані покупця (стираються); `operational` — решта. */
export type OrderColumnPrivacy = 'personal' | 'operational';

/**
 * Реєстр ПД колонок `orders` (Е6г-7). Тип `{ [K in keyof Order] }` —
 * найсильніший гейт: нова drizzle-колонка без запису тут не компілюється, тож
 * «право на забуття» не мине її мовчки. Парність із реальною БД доводить
 * харнес (`order-privacy-registry.test.ts`) через `information_schema`.
 *
 * `userId`, `accessToken` і `saved*Id` теж `personal`: вони привʼязують
 * замовлення до особи (або дають доступ до нього), тож знеособлене замовлення
 * мусить їх втратити.
 */
export const ORDER_COLUMN_PRIVACY: {
  readonly [K in keyof Order]: OrderColumnPrivacy;
} = {
  id: 'operational',
  userId: 'personal',
  orderNumber: 'operational',
  statusId: 'operational',
  firstName: 'personal',
  lastName: 'personal',
  email: 'personal',
  phone: 'personal',
  deliveryAddress: 'personal',
  deliveryCity: 'personal',
  paymentMethod: 'operational',
  subtotal: 'operational',
  total: 'operational',
  notes: 'personal',
  createdAt: 'operational',
  updatedAt: 'operational',
  accessToken: 'personal',
  shippingMethodId: 'operational',
  shippingZoneId: 'operational',
  shippingRateId: 'operational',
  shippingCost: 'operational',
  pickupPointId: 'operational',
  shippingData: 'personal',
  hasDifferentRecipient: 'operational',
  recipientFirstName: 'personal',
  recipientLastName: 'personal',
  recipientPhone: 'personal',
  recipientEmail: 'personal',
  savedRecipientId: 'personal',
  savedAddressId: 'personal',
  personalDataErasedAt: 'operational',
};

/**
 * Знімок доставки: `kind` адресної доставки лишається (спека §7.3), місто й
 * адреса обнуляються. Точка видачі й зіпсований `{}` (`#>>` дає NULL) — без змін.
 */
const SHIPPING_DATA_ERASED: SQL = sql`case when ${orders.shippingData} #>> '{destination,kind}' = 'address' then jsonb_set(${orders.shippingData}, '{destination}', '{"kind":"address","city":null,"address":null}'::jsonb) else ${orders.shippingData} end`;

/**
 * Знеособлює ВСІ замовлення покупця одним `UPDATE`. SET будується з реєстру:
 * нова `personal` колонка стирається без правки функції (крім `shippingData`,
 * яка стирається частково — її знімок лишається розбірним).
 * Повертає кількість знеособлених замовлень.
 */
export async function eraseOrderPersonalData(
  db: ActorDb,
  userId: string,
  now: Date,
): Promise<number> {
  const set: Record<string, unknown> = { personalDataErasedAt: now };
  for (const [key, privacy] of Object.entries(ORDER_COLUMN_PRIVACY)) {
    if (privacy !== 'personal') continue;
    set[key] = key === 'shippingData' ? SHIPPING_DATA_ERASED : null;
  }
  const erased = await db
    .update(orders)
    .set(set as never)
    .where(eq(orders.userId, userId))
    .returning({ id: orders.id });
  return erased.length;
}
