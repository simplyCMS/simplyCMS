import { randomUUID } from 'node:crypto';
import type {
  CheckoutQuote,
  PlaceOrderInput,
  QuoteCheckoutResult,
  QuotedItem,
} from 'simplycms/contracts';
import { withCustomerDb, withOrderTokenDb, type ActorDb } from './db';
import { prepareCheckout } from './prepare-checkout';

/**
 * Квота чекауту — ті самі числа, які запише `placeOrderFor`, БЕЗ запису
 * (розділ M рішень архітектора). Ділить `prepareCheckout` з оформленням:
 * «показане покупцю = записане в БД» тримається ЗА ПОБУДОВОЮ, а не звіркою
 * двох реалізацій.
 *
 * 🔴 Гість не має ідентичності на момент квоти — токен ОДНОРАЗОВИЙ і
 * одразу відкидається, актор той самий (`app_user` без `userId`), що й при
 * оформленні: тип ціни й категорія читаються так само, як на записі. Нуль
 * нових шляхів у БД — жодного рядка квота не лишає.
 */
export async function quoteCheckoutFor(
  input: PlaceOrderInput,
  userId: string | null,
): Promise<QuoteCheckoutResult> {
  if (input.items.length === 0) {
    return { ok: false, reason: 'not_purchasable' };
  }

  const run = <T>(fn: (db: ActorDb) => Promise<T>): Promise<T> =>
    userId === null
      ? withOrderTokenDb(randomUUID(), (db) => fn(db))
      : withCustomerDb(userId, (db) => fn(db));

  const prepared = await run((db) => prepareCheckout(db, input, userId));
  if (!prepared.ok) return prepared;

  const items: QuotedItem[] = prepared.items.map((item) => ({
    productId: item.productId,
    modificationId: item.modificationId,
    name: item.name,
    price: item.price,
    basePrice: item.basePrice,
    quantity: item.quantity,
  }));
  const quote: CheckoutQuote = {
    items,
    subtotal: prepared.subtotal,
    shippingCost: prepared.shippingCost,
    total: prepared.subtotal + prepared.shippingCost,
  };
  return { ok: true, quote };
}
