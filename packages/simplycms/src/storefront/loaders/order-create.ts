import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { orderItems, orders, shippingMethods } from 'simplycms/schema';
import type { JsonValue } from './entities/property';
import type { ActorDb } from './db';
import { loadDefaultStatusId } from './order-statuses';

/** Позиція кошика в тому вигляді, в якому вона лягає в замовлення. */
export interface NewOrderItem {
  productId: string | null;
  modificationId: string | null;
  name: string;
  price: number;
  quantity: number;
  basePrice: number | null;
  discountData: JsonValue | null;
}

/** Контактні й доставкові дані оформлення. */
export interface NewOrderInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  shippingMethodId: string;
  deliveryCity: string | null;
  deliveryAddress: string | null;
  pickupPointId: string | null;
  paymentMethod: string;
  notes: string | null;
  subtotal: number;
  shippingCost: number;
  total: number;
  hasDifferentRecipient: boolean;
  recipientFirstName: string | null;
  recipientLastName: string | null;
  recipientPhone: string | null;
  recipientEmail: string | null;
  savedRecipientId: string | null;
  savedAddressId: string | null;
  items: NewOrderItem[];
}

/** Що повертається клієнту після оформлення. */
export interface CreatedOrder {
  id: string;
  orderNumber: string;
  /** Токен гостьового замовлення; для залогіненого — `null`. */
  accessToken: string | null;
}

/**
 * Номер замовлення.
 *
 * 🔴 Генерується в TS, бо тригера `generate_order_number` у схемі v2 НЕМАЄ:
 * baseline B13 не везе жодної plpgsql-функції, крім читача актора. Формат —
 * дата плюс випадковий хвіст; унікальність тримає ключ `orders_order_number_key`,
 * а не надія на послідовність.
 */
function generateOrderNumber(now: Date): string {
  const stamp = now.toISOString().slice(2, 10).replace(/-/g, '');
  const tail = randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
  return `${stamp}-${tail}`;
}

/**
 * Створює замовлення разом із позиціями — однією транзакцією актора.
 *
 * 🔴 `userId` — з серверної сесії або `null` для гостя; політика
 * `orders_insert_own` приймає рівно ці два випадки. Гостю одразу видається
 * `access_token`, і саме він має бути в GUC `app.order_token` ЦІЄЇ транзакції:
 * без нього `insert … returning` впав би на власній же SELECT-політиці.
 */
export async function createOrder(
  db: ActorDb,
  userId: string | null,
  accessToken: string | null,
  input: NewOrderInput,
): Promise<CreatedOrder> {
  const [method] = await db
    .select({ code: shippingMethods.code })
    .from(shippingMethods)
    .where(eq(shippingMethods.id, input.shippingMethodId))
    .limit(1);

  const orderNumber = generateOrderNumber(new Date());
  // Ключ замовлення відомий ДО вставки — тому `.returning()` більше не
  // потрібен: позиції нижче можуть посилатись на нього одразу.
  const orderId = randomUUID();

  await db.insert(orders).values({
    id: orderId,
    userId,
    accessToken,
    orderNumber,
    statusId: await loadDefaultStatusId(db),
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    deliveryMethod: method?.code ?? null,
    deliveryCity: input.deliveryCity,
    deliveryAddress: input.deliveryAddress,
    paymentMethod: input.paymentMethod,
    notes: input.notes,
    subtotal: input.subtotal.toFixed(2),
    total: input.total.toFixed(2),
    shippingMethodId: input.shippingMethodId,
    shippingCost: input.shippingCost.toFixed(2),
    pickupPointId: input.pickupPointId,
    shippingData: {},
    hasDifferentRecipient: input.hasDifferentRecipient,
    recipientFirstName: input.recipientFirstName,
    recipientLastName: input.recipientLastName,
    recipientPhone: input.recipientPhone,
    recipientEmail: input.recipientEmail,
    savedRecipientId: input.savedRecipientId,
    savedAddressId: input.savedAddressId,
  });

  await db.insert(orderItems).values(
    input.items.map((item) => ({
      id: randomUUID(),
      orderId,
      productId: item.productId,
      modificationId: item.modificationId,
      name: item.name,
      price: item.price.toFixed(2),
      quantity: item.quantity,
      total: (item.price * item.quantity).toFixed(2),
      basePrice: item.basePrice === null ? null : item.basePrice.toFixed(2),
      discountData: item.discountData ?? null,
    })),
  );

  return { id: orderId, orderNumber, accessToken };
}
