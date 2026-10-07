import type {
  CheckoutItemInput,
  PlaceOrderRejection,
} from 'simplycms/contracts';
import type { ActorDb } from 'simplycms/db';
import type { JsonValue } from 'simplycms/schema/types';
import { priceCart } from './price-cart';
import { loadPricingContext } from './pricing-context';

/** Позиція в тому вигляді, в якому вона лягає в замовлення. */
export interface NewOrderItem {
  productId: string | null;
  modificationId: string | null;
  name: string;
  price: number;
  quantity: number;
  basePrice: number | null;
  discountData: JsonValue | null;
}

/**
 * Серверне ціноутворення позицій замовлення (К2-Е0, Е0-4; спільне з адмінкою —
 * К3-Е5б) — обгортка над ядром `loadPricingContext` + `priceCart` (Е6в-9).
 *
 * 🔴 Те саме ядро рахує картку, квоту кошика й діагностику ціни: окремий
 * контекст тут уже був дефектом розходження знижок (B2 аудиту r1). Недоступна
 * позиція в ядрі — рядок `available: false`; ЗАМОВЛЕННЯ ж із такою позицією
 * не оформлюється — звідси відмова `not_purchasable` цілим кошиком.
 *
 * 🔴 `discountData = { applied }` — лише знижки, що УВІЙШЛИ в суму (Е6в-5):
 * знімок позиції пояснює чек до копійки, без програвших і обрізаних.
 *
 * `opts.extraCartTotal` (Е5б-6) — сума кошика ПОЗА `items` (адмінка додає
 * позицію до замовлення: знижка «від суми» бачить весь склад). Чекаут — без.
 */
export async function priceItems(
  db: ActorDb,
  userId: string | null,
  items: CheckoutItemInput[],
  opts?: { extraCartTotal?: number },
): Promise<NewOrderItem[] | Extract<PlaceOrderRejection, 'not_purchasable'>> {
  const ctx = await loadPricingContext(db, userId);
  const { lines } = await priceCart(db, ctx, items, opts);

  const result: NewOrderItem[] = [];
  for (const line of lines) {
    if (!line.available) return 'not_purchasable';
    const discounted = line.applied.length > 0;
    result.push({
      productId: line.productId,
      modificationId: line.modificationId,
      name: line.name,
      price: line.price,
      quantity: line.quantity,
      basePrice: discounted ? line.basePrice : null,
      discountData: discounted
        ? { applied: line.applied as unknown as JsonValue }
        : null,
    });
  }
  return result;
}
