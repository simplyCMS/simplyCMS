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
import type { CheckoutItemInput } from 'simplycms/contracts';
import * as F from './fixtures/commerce';
import { guest, line, useCommerceDb } from './fixtures/commerce-db';
import { percentDiscountStatements } from './fixtures/discounts';

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
});
