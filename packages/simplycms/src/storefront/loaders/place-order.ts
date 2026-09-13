import { randomUUID } from 'node:crypto';
import type { PlaceOrderInput, PlaceOrderResult } from 'simplycms/contracts';
import {
  findShippingZoneIn,
  resolveShippingRate,
} from 'simplycms/domain/shipping';
import {
  withCustomerDb,
  withOrderTokenDb,
  type ActorDb,
  type OperatorEscalation,
} from './db';
import { priceCheckoutItems } from './checkout-items';
import { createOrder } from './order-create';
import { resolveRecipient, toOrderInput } from './place-order-support';
import { InsufficientStockError } from './stock-reservation';
import { loadShippingDirectory } from './shipping';

/**
 * Логіка оформлення без RPC-обгортки — щоб харнес доводив воронку напряму.
 *
 * 🔴 Живе в server-only дереві `storefront` (декларація межі), а не другим
 * експортом поруч із serverFn: у клієнтському модулі не-serverFn експорт
 * лишається живим і тягне лоадери в клієнтський граф — Import Protection
 * валить збірку магазину (той самий клас, що описано в `core/lib/price-type.ts`).
 *
 * 🔴 ОДНА транзакція на все: довідники, ціни, отримувач, запис. Дві
 * послідовні (спершу читання, потім запис) залишали б вікно, у якому ціна,
 * тариф чи залишок змінюються між ними (B3 аудиту r1). Відмови — значеннями
 * (до жодного запису), нестача залишку — винятком з відкатом усередині
 * `createOrder` (списання — під ескалацією, див. `escalationFor`).
 */
export async function placeOrderFor(
  input: PlaceOrderInput,
  userId: string | null,
): Promise<PlaceOrderResult> {
  const accessToken = userId === null ? randomUUID() : null;
  const run = <T>(
    fn: (db: ActorDb, operator: OperatorEscalation) => Promise<T>,
  ): Promise<T> =>
    userId === null
      ? withOrderTokenDb(accessToken as string, fn)
      : withCustomerDb(userId, fn);

  try {
    return await run(async (db, operator) => {
      const directory = await loadShippingDirectory(db);
      const method = directory.methods.find(
        (m) => m.id === input.shippingMethodId && m.is_active,
      );
      if (!method)
        return { ok: false, reason: 'shipping_unavailable' } as const;

      // Pickup — за КОДОМ методу, як і UI (`CheckoutDeliveryForm`: `code === 'pickup'`):
      // pickup вимагає активну точку ЦЬОГО методу; не-pickup точки не приймає.
      const isPickup = method.code === 'pickup';
      const point = input.pickupPointId
        ? directory.pickupPoints.find(
            (p) =>
              p.id === input.pickupPointId &&
              p.method_id === method.id &&
              p.is_active,
          )
        : null;
      if (isPickup && !point)
        return { ok: false, reason: 'pickup_point_invalid' } as const;
      if (!isPickup && input.pickupPointId)
        return { ok: false, reason: 'pickup_point_invalid' } as const;

      const items = await priceCheckoutItems(db, userId, input.items);
      if (items === 'not_purchasable')
        return { ok: false, reason: 'not_purchasable' } as const;

      const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
      const zone = findShippingZoneIn(
        directory.zones,
        input.deliveryCity ?? '',
      );
      const rate = resolveShippingRate(
        { method, zone, cart: { items: [], subtotal } },
        directory.rates,
      );
      // `null` — жодного застосовного тарифу: це НЕ «безкоштовно», а відмова.
      if (rate === null)
        return { ok: false, reason: 'shipping_unavailable' } as const;

      const savedRecipientId = await resolveRecipient(db, userId, input);
      const order = await createOrder(
        db,
        userId,
        accessToken,
        toOrderInput(input, savedRecipientId, {
          items,
          subtotal,
          shippingCost: rate.cost,
        }),
        operator,
      );
      return { ok: true, order } as const;
    });
  } catch (error) {
    if (error instanceof InsufficientStockError)
      return { ok: false, reason: 'not_purchasable' };
    throw error;
  }
}
