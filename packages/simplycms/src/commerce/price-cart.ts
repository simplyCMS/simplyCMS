import type {
  AppliedDiscount,
  CheckoutItemInput,
  DiscountContext,
  RejectedDiscount,
  ThresholdHint,
} from 'simplycms/contracts';
import type { ActorDb } from 'simplycms/db';
import {
  discountThresholdHints,
  resolveDiscount,
} from 'simplycms/domain/discounts';
import { toCents } from 'simplycms/domain/pricing';
import { loadCatalog } from './price-cart-catalog';
import type { PricingContext } from './pricing-context';

/** Позиція, яку можна купити, з ціною після знижок і поясненням. */
export interface PricedLine {
  available: true;
  productId: string;
  modificationId: string | null;
  name: string;
  quantity: number;
  basePrice: number;
  price: number;
  applied: AppliedDiscount[];
  rejected: RejectedDiscount[];
  hints: ThresholdHint[];
}

/** Позиція, якої купити не можна: товар зник, вимкнений, без ціни чи залишку. */
export interface UnavailableLine {
  available: false;
  productId: string;
  modificationId: string | null;
  quantity: number;
}

/**
 * Ціни позицій кошика одним контекстом (Е6в-9) — спільне ядро квоти кошика,
 * чекауту, адмінки й діагностики ціни. Кошик несе лише id і кількість —
 * назва, ціна і статус беруться з БД у транзакції викликача.
 *
 * 🔴 `cartTotal` — сума БАЗОВИХ цін ДОСТУПНИХ рядків + `extraCartTotal`,
 * складена ЦІЛИМИ центами: знижка «від суми» не має спрацювати на рівному
 * порозі через хвіст float (`0.1 + 0.2 > 0.3`). Усі рядки рахуються з ОДНИМ
 * `cartTotal` і ОДНИМ `ctx.now`.
 *
 * `opts.extraCartTotal` (Е5б-6) — сума кошика ПОЗА `items` (адмінка додає
 * позицію до замовлення: знижка «від суми» бачить весь склад).
 */
export async function priceCart(
  db: ActorDb,
  ctx: PricingContext,
  items: CheckoutItemInput[],
  opts?: { extraCartTotal?: number },
): Promise<{ lines: (PricedLine | UnavailableLine)[]; cartTotal: number }> {
  const extra = opts?.extraCartTotal ?? 0;
  if (!Number.isFinite(extra) || extra < 0)
    throw new Error('[simplycms/commerce] extraCartTotal — невідʼємне число');
  if (items.length === 0) return { lines: [], cartTotal: toCents(extra) / 100 };

  const resolve = await loadCatalog(db, ctx, items);
  const resolved = items.map((item) => ({ item, found: resolve(item) }));
  const cartTotal =
    resolved.reduce(
      (cents, { item, found }) =>
        found ? cents + toCents(found.basePrice) * item.quantity : cents,
      toCents(extra),
    ) / 100;

  const lines = resolved.map(
    ({ item, found }): PricedLine | UnavailableLine => {
      const { productId, modificationId, quantity } = item;
      if (!found)
        return { available: false, productId, modificationId, quantity };
      const discountCtx: DiscountContext = {
        customer: { categoryId: ctx.categoryId, isLoggedIn: ctx.isLoggedIn },
        item: {
          productId,
          modificationId,
          sectionId: found.sectionId,
          quantity,
        },
        cart: { total: cartTotal },
        now: ctx.now,
      };
      const result = resolveDiscount(found.basePrice, ctx.forest, discountCtx);
      return {
        available: true,
        productId,
        modificationId,
        name: found.name,
        quantity,
        basePrice: found.basePrice,
        price: result.finalPrice,
        applied: result.appliedDiscounts,
        rejected: result.rejectedDiscounts,
        hints: discountThresholdHints(found.basePrice, ctx.forest, discountCtx),
      };
    },
  );
  return { lines, cartTotal };
}
