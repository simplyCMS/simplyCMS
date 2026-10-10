/**
 * Замовлення сіду (С-2, С-4): оформлення тим самим ядром, що й вітрина
 * (`placeOrderFor` — гості й покупці, списання залишку, автоправило категорії
 * після COMMIT), потім статуси ядром адмінки `changeOrderStatus` — зокрема
 * `cancelled` з поверненням залишку.
 *
 * 🔴 Вхід оформлення проходить ту саму Zod-схему, що й серверна функція
 * чекауту (`checkoutInputSchema`): сід не пише того, чого не пропустила б
 * вітрина.
 */
import { asc } from 'drizzle-orm';
import {
  changeOrderStatus,
  changeOrderStatusInput,
} from '../../packages/simplycms/src/admin-server/impl/index.ts';
import type { ActorDb } from '../../packages/simplycms/src/db/index.ts';
import { orderStatuses } from '../../packages/simplycms/src/schema/index.ts';
import { placeOrderFor } from '../../packages/simplycms/src/storefront/loaders/place-order.ts';
import { checkoutInputSchema } from '../../packages/simplycms/src/storefront-routes/server/checkout-input.ts';
import type { PlannedOrder } from './orders-plan.mts';
import type { People } from './people.mts';
import type { ShippingIds } from './shipping.mts';

/** Оформлене замовлення плану: id у БД + те, що з нього читають далі. */
export type PlacedOrder = PlannedOrder & {
  readonly id: string;
  readonly userId: string | null;
};

function checkoutOf(order: PlannedOrder, shipping: ShippingIds) {
  const { person, delivery } = order;
  const pickup = delivery.kind === 'pickup';
  return checkoutInputSchema.parse({
    firstName: person.firstName,
    lastName: person.lastName,
    email: person.email,
    phone: person.phone,
    shippingMethodId: pickup
      ? shipping.pickupMethodId
      : shipping.courierMethodId,
    deliveryCity: pickup ? null : delivery.city,
    deliveryAddress: pickup ? null : delivery.address,
    pickupPointId: pickup
      ? delivery.point === 'system'
        ? shipping.systemPointId
        : shipping.secondPointId
      : null,
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
    items: order.items.map(({ target, quantity }) => ({
      productId: target.productId,
      modificationId: target.modificationId,
      quantity,
    })),
  });
}

/** Оформлює план по черзі (від найстаршого); відмова — виняток, не пропуск. */
export async function placeOrders(
  plan: readonly PlannedOrder[],
  people: People,
  shipping: ShippingIds,
): Promise<PlacedOrder[]> {
  const placed: PlacedOrder[] = [];
  for (const order of plan) {
    const userId = order.buyer === null ? null : people.buyers[order.buyer]!.id;
    const result = await placeOrderFor(checkoutOf(order, shipping), userId);
    if (!result.ok)
      throw new Error(
        `[showcase] замовлення ${order.person.email} відхилено: ${result.reason}`,
      );
    placed.push({ ...order, id: result.order.id, userId });
  }
  return placed;
}

/** Статуси плану ядром адмінки; `new` — дефолт оформлення, його не чіпаємо. */
export async function applyStatuses(
  db: ActorDb,
  placed: readonly PlacedOrder[],
): Promise<void> {
  const rows = await db
    .select({ id: orderStatuses.id, code: orderStatuses.code })
    .from(orderStatuses)
    .orderBy(asc(orderStatuses.sortOrder));
  const idOf = new Map(rows.map((r) => [r.code, r.id]));
  for (const order of placed) {
    if (order.status === 'new') continue;
    const statusId = idOf.get(order.status);
    if (!statusId) throw new Error(`[showcase] немає статусу ${order.status}`);
    await changeOrderStatus(
      db,
      changeOrderStatusInput.parse({ orderId: order.id, statusId }),
    );
  }
}
