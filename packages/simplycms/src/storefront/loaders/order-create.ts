import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { orderItems, orders, shippingMethods } from 'simplycms/schema';
import type { ActorDb, OperatorEscalation } from './db';
import type { CreatedOrder, NewOrderInput } from './entities/new-order';
import { loadDefaultStatusId } from './order-statuses';
import { reserveOrderStock } from './order-stock';

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
 * `access_token`, і саме він має бути в GUC `app.order_token` ЦІЄЇ транзакції.
 * Причина — НЕ `returning` (його знято): падає вставка ПОЗИЦІЙ. Політика
 * `order_items_insert_own` має
 * `WITH CHECK (exists (select 1 from orders where orders.id = order_items.order_id
 * and (orders.user_id = (select app.current_user_id()) or orders.user_id is null)))`,
 * і цей підзапит виконується під тим самим актором, тобто підпадає під RLS
 * `orders`. Для гостя `orders_select_own_or_token` пускає рядок лише гілкою
 * `access_token = current_setting('app.order_token')` — без токена в GUC
 * підзапит нічого не бачить, `WITH CHECK` не виконується і `order_items`
 * не вставляються.
 */
export async function createOrder(
  db: ActorDb,
  userId: string | null,
  accessToken: string | null,
  input: NewOrderInput,
  operator: OperatorEscalation,
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

  // 🔴 Списання — ПІСЛЯ того, як RLS прийняла вставку замовлення й позицій
  // покупцем: право на цю транзакцію вже доведено, а службова дія йде під
  // операторською роллю в ТІЙ САМІЙ транзакції (див. `escalationFor`).
  // `NewOrderItem` структурно є `StockLine`, тож перекладати нічого.
  await operator((odb) =>
    reserveOrderStock(odb, input.items, input.pickupPointId),
  );

  return { id: orderId, orderNumber, accessToken };
}
