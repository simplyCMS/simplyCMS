// Спільне ядро ціноутворення (К3-Е6в, Е6в-9): `loadPricingContext` +
// `priceCart` — квота кошика, чекаут і адмінка рахують одним кодом.
// Недоступна позиція — рядок `available: false`, а не відмова всього кошика;
// відмову робить обгортка `priceItems`.
import { beforeAll, describe, expect, it } from 'vitest';
import {
  loadPricingContext,
  priceCart,
  priceItems,
  type PricedLine,
} from 'simplycms/commerce';
import type {
  AvailableCartQuoteLine,
  CartQuote,
  CheckoutItemInput,
} from 'simplycms/contracts';
import { quoteCartFor, quoteCheckoutFor } from 'simplycms/storefront/loaders';
import * as F from './fixtures/commerce';
import { guest, line, useCommerceDb } from './fixtures/commerce-db';
import { percentDiscountStatements } from './fixtures/discounts';
import { orderInput } from './fixtures/orders';

/** Демо-товар без модифікацій, який контур вимикає (`is_active = false`). */
const DISABLED = '10000002-0000-4000-8000-000000000003';
const INVERTER_BASE = 24500;
const STATION_BASE = 68000;

const quote = (items: CheckoutItemInput[]) =>
  guest(async (db) => priceCart(db, await loadPricingContext(db, null), items));
const priced = (l: { available: boolean }): PricedLine => {
  if (!l.available) throw new Error('рядок недоступний');
  return l as PricedLine;
};
const quoted = (l: CartQuote['lines'][number]): AvailableCartQuoteLine => {
  if (!l.available) throw new Error('рядок квоти недоступний');
  return l;
};
/** Однофазний 5 кВт: 18300 ₴, жодної іншої знижки в контурі. */
const INVERTER_5KW_1PH_BASE = 18300;

describe('ядро priceCart', () => {
  const db = useCommerceDb('simplycms_price_cart');

  beforeAll(async () => {
    await db.run(
      `update public.products set is_active = false where id = '${DISABLED}'`,
    );
    // Дві знижки «від суми» на ДВА різні товари: поріг 50000 жоден рядок
    // окремо не бере, кошик разом — бере.
    const statements = [
      ...percentDiscountStatements({
        group: 'Кошик від 50000',
        name: 'Інвертор від суми −5%',
        percent: 5,
        threshold: { type: 'min_order_amount', operator: '>=', value: 50000 },
        target: { type: 'product', id: F.INVERTER_8KW },
      }),
      ...percentDiscountStatements({
        group: 'Від 3 шт',
        name: 'Станція від 3 шт −10%',
        percent: 10,
        threshold: { type: 'min_quantity', operator: '>=', value: 3 },
        target: { type: 'product', id: F.STATION_10KWH },
      }),
      // Група `max` з двома порогами на ту саму кількість (Е6в-12): на порозі
      // перемагає більша знижка, і підказка мусить показати саме її ціну.
      ...percentDiscountStatements({
        group: 'Інвертор 5 кВт: краща з двох',
        operator: 'max',
        name: 'Від 3 шт −10%',
        percent: 10,
        threshold: { type: 'min_quantity', operator: '>=', value: 3 },
        target: { type: 'product', id: F.INVERTER_5KW },
      }),
      ...percentDiscountStatements({
        group: 'Інвертор 5 кВт: краща з двох',
        name: 'Від 3 шт −50 ₴',
        percent: 50,
        discountType: 'fixed_amount',
        threshold: { type: 'min_quantity', operator: '>=', value: 3 },
        target: { type: 'product', id: F.INVERTER_5KW },
      }),
    ];
    for (const s of statements) await db.run(s);
  });

  it('вимкнений товар — рядок available:false, cartTotal лише з доступних', async () => {
    const out = await quote([line(F.INVERTER_8KW), line(DISABLED, 2)]);
    expect(out.lines.map((l) => l.available)).toEqual([true, false]);
    expect(out.lines[1]).toEqual({
      available: false,
      productId: DISABLED,
      modificationId: null,
      quantity: 2,
    });
    expect(out.cartTotal).toBe(INVERTER_BASE);
  });

  it('priceItems на тому самому вході відмовляє not_purchasable', async () => {
    const out = await guest((tx) =>
      priceItems(tx, null, [line(F.INVERTER_8KW), line(DISABLED, 2)]),
    );
    expect(out).toBe('not_purchasable');
  });

  it('позиції під min_order_amount рахуються з ОДНИМ cartTotal кошика', async () => {
    // Окремо: 21000 і 49000 < 50000; разом 70000 — обидві знижки діють.
    const out = await quote([line(F.BATTERY_200AH), line(F.INVERTER_8KW, 2)]);
    expect(out.cartTotal).toBe(21000 + 2 * INVERTER_BASE);
    const [battery, inverter] = out.lines.map(priced);
    expect(battery).toMatchObject({ basePrice: 21000, price: 19950 });
    expect(inverter).toMatchObject({ basePrice: INVERTER_BASE, price: 23275 });
    expect(inverter.applied.map((a) => a.name)).toEqual([
      'Інвертор від суми −5%',
    ]);
  });

  it('рядок несе підказку порогу кількості, якого ще не досягнуто', async () => {
    const out = await quote([line(F.STATION_10KWH)]);
    const station = priced(out.lines[0]);
    expect(station).toMatchObject({
      price: STATION_BASE,
      basePrice: STATION_BASE,
      applied: [],
    });
    expect(station.hints).toEqual([
      {
        kind: 'quantity',
        threshold: 3,
        finalPrice: STATION_BASE * 0.9,
        percentOff: 10,
      },
    ]);
    // Відхилена знижка пояснена кодом — не мовчки відсутня.
    expect(station.rejected).toContainEqual(
      expect.objectContaining({
        name: 'Станція від 3 шт −10%',
        reason: 'condition_failed',
        conditionType: 'min_quantity',
      }),
    );
  });

  // ── Квота кошика (Е6в-13): `quoteCartFor` — та сама `priceCart`, що й чек ──

  /** Кошик на кількох знижках: оракул (−10 % роздробу), від суми, гурт. */
  const PARITY_CART: CheckoutItemInput[] = [
    line(F.PANEL_450, 2),
    line(F.STATION_10KWH),
    line(F.BATTERY_200AH),
  ];

  const actors: [string, () => string | null][] = [
    ['гість', () => null],
    ['покупець гуртової категорії', () => db.wholesale],
  ];
  it.each(actors)(
    'картка-кошик-чек: ціни quoteCartFor = quoteCheckoutFor (%s)',
    async (_who, actor) => {
      const userId = actor();
      const cart = await quoteCartFor(PARITY_CART, userId);
      const checkout = await quoteCheckoutFor(
        { ...orderInput(db.pickup, db.point, []), items: PARITY_CART },
        userId,
      );
      if (!checkout.ok) throw new Error(`квота чекауту: ${checkout.reason}`);
      expect(cart.lines.map((l) => quoted(l).price)).toEqual(
        checkout.quote.items.map((i) => i.price),
      );
      expect(cart.subtotal).toBe(checkout.quote.subtotal);
    },
  );

  it('категорія покупця змінює ціну квоти (гурт бачить свою базу)', async () => {
    const guestQuote = await quoteCartFor([line(F.STATION_10KWH)], null);
    const wholesale = await quoteCartFor([line(F.STATION_10KWH)], db.wholesale);
    expect(quoted(guestQuote.lines[0]).basePrice).toBe(STATION_BASE);
    expect(quoted(wholesale.lines[0]).basePrice).toBe(
      F.WHOLESALE_STATION_PRICE,
    );
  });

  it('вимкнений товар у кошику — рядок available:false, subtotal без нього', async () => {
    const out = await quoteCartFor(
      [line(F.INVERTER_8KW), line(DISABLED, 2)],
      null,
    );
    expect(out.lines[1]).toEqual({
      available: false,
      productId: DISABLED,
      modificationId: null,
      quantity: 2,
    });
    expect(out.subtotal).toBe(INVERTER_BASE);
  });

  it('рядок квоти несе лише назву й суму застосованих знижок', async () => {
    const out = await quoteCartFor([line(F.PANEL_450)], null);
    expect(quoted(out.lines[0])).toMatchObject({
      basePrice: 4800,
      price: 4320,
      applied: [{ name: F.ORACLE_DISCOUNT, calculatedAmount: 480 }],
    });
    expect(Object.keys(quoted(out.lines[0]).applied[0]).sort()).toEqual([
      'calculatedAmount',
      'name',
    ]);
  });

  it('група max: підказка на кількості 1 = ціна квоти на порозі 3', async () => {
    const one = await quoteCartFor(
      [line(F.INVERTER_5KW, 1, F.INVERTER_5KW_1PH)],
      null,
    );
    const three = await quoteCartFor(
      [line(F.INVERTER_5KW, 3, F.INVERTER_5KW_1PH)],
      null,
    );
    const hint = quoted(one.lines[0]).hints[0];
    expect(hint).toMatchObject({ kind: 'quantity', threshold: 3 });
    expect(hint.finalPrice).toBe(quoted(three.lines[0]).price);
    // −10 % (1830) перемагає −50 ₴ — підказка не «найбільша умова», а рушій.
    expect(hint.finalPrice).toBe(INVERTER_5KW_1PH_BASE * 0.9);
    expect(quoted(three.lines[0]).applied.map((a) => a.name)).toEqual([
      'Від 3 шт −10%',
    ]);
  });
});
