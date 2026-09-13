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
 * двох реалізацій — і `total`, і гвард порожнього кошика рахує та сама
 * `prepareCheckout`, а не друга копія в цій функції (рев'ю I1/#9).
 *
 * 🔴 Гість не має ідентичності на момент квоти — токен ОДНОРАЗОВИЙ і
 * одразу відкидається, актор той самий (`app_user` без `userId`), що й при
 * оформленні: тип ціни й категорія читаються так само, як на записі. Нуль
 * нових шляхів у БД — жодного рядка квота не лишає.
 *
 * 🔴 **Названа межа (рев'ю #10):** квота НЕ бачить нестачі залишку.
 * `InsufficientStockError` кидає `reserveStock` усередині `createOrder`,
 * якого ця функція не кличе (квота нічого не пише) — тому послідовність
 * «квота `ok:true` → оформлення тим самим входом `not_purchasable`»
 * МОЖЛИВА (конкурент забрав останні одиниці між квотою і сабмітом). Це
 * той самий клас вікна, що назва «Вікно між квотою і кліком» описує для
 * ціни (беклог К2), лише для залишку — не дефект цієї задачі, а межа, яку
 * `placeOrder` і так ловить власним `try/catch` на сабміті.
 */
export async function quoteCheckoutFor(
  input: PlaceOrderInput,
  userId: string | null,
): Promise<QuoteCheckoutResult> {
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
    total: prepared.total,
  };
  return { ok: true, quote };
}
