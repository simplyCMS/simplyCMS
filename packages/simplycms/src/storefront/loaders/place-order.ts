import { randomUUID } from 'node:crypto';
import type { PlaceOrderInput, PlaceOrderResult } from 'simplycms/contracts';
import {
  withCustomerDb,
  withOrderTokenDb,
  type ActorDb,
  type OperatorEscalation,
} from './db';
import { prepareCheckout } from './prepare-checkout';
import { createOrder } from './order-create';
import { resolveRecipient, toOrderInput } from './place-order-support';
import { InsufficientStockError } from './stock-reservation';

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
  // 🔴 Порожній кошик — `prepareCheckout` відмовляє ДО priceCheckoutItems
  // (гвард живе там, спільний з квотою — рев'ю #9, докладніше в
  // `prepare-checkout.ts`), не тут: другий незалежний гвард на той самий
  // предикат — саме те дублювання, з яким весь розділ M бореться.
  const accessToken = userId === null ? randomUUID() : null;
  const run = <T>(
    fn: (db: ActorDb, operator: OperatorEscalation) => Promise<T>,
  ): Promise<T> =>
    userId === null
      ? withOrderTokenDb(accessToken as string, fn)
      : withCustomerDb(userId, fn);

  try {
    return await run(async (db, operator) => {
      const prepared = await prepareCheckout(db, input, userId);
      if (!prepared.ok) return prepared;

      const savedRecipientId = await resolveRecipient(db, userId, input);
      const order = await createOrder(
        db,
        userId,
        accessToken,
        toOrderInput(input, savedRecipientId, {
          items: prepared.items,
          subtotal: prepared.subtotal,
          shippingCost: prepared.shippingCost,
          total: prepared.total,
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
