// `simplycms/commerce` (К3-Е5б, Task 1): рушій ціноутворення, спільний для
// чекауту й адмінки. Числа оракула і гуртова/від-суми гілки ЗАФІКСОВАНІ на
// СТАРОМУ рушії (`priceCheckoutItems` зі `storefront/loaders`) ДО переїзду —
// тест доводить, що переїзд нічого не змінив, а не те, що новий код
// узгоджений сам із собою. Доставка й пріоритет відмов — `commerce-shipping`.
import { describe, expect, it } from 'vitest';
import { withActor } from 'simplycms/db';
import { priceItems } from 'simplycms/commerce';
import * as F from './fixtures/commerce';
import { guest, line, useCommerceDb } from './fixtures/commerce-db';

/** Пара `[price, basePrice]` кожної позиції — для кейсів без `discountData`. */
const unit = (out: Awaited<ReturnType<typeof priceItems>>) =>
  out === 'not_purchasable' ? out : out.map((i) => [i.price, i.basePrice]);

/** Застосована знижка «від суми» на акумулятор (−5 % від 21000). */
const CART_APPLIED = {
  applied: [
    {
      id: F.CART_DISCOUNT_ID,
      name: F.CART_DISCOUNT,
      type: 'percent',
      value: 5,
      calculatedAmount: 1050,
      groupName: F.CART_GROUP,
    },
  ],
};

describe('рушій цін commerce: priceItems', () => {
  const ids = useCommerceDb('simplycms_commerce_pricing');

  it('priceItems без opts дає ЗАФІКСОВАНІ до переїзду значення (price, basePrice, discountData) — оракул: очікування з checkout-flow.test.ts:~227 і явні числа демо-фікстур, записані в Step 1', async () => {
    const out = await guest((db) =>
      priceItems(db, null, [
        line(F.PANEL_450, 2),
        line(F.INVERTER_8KW),
        line(F.INVERTER_5KW, 1, F.INVERTER_5KW_1PH),
      ]),
    );
    expect(out).toEqual([
      {
        productId: F.PANEL_450,
        modificationId: null,
        name: 'Сонячна панель 450 Вт монокристалічна',
        price: 4320,
        quantity: 2,
        basePrice: 4800,
        discountData: {
          applied: [
            {
              id: F.ORACLE_DISCOUNT_ID,
              name: F.ORACLE_DISCOUNT,
              type: 'percent',
              value: 10,
              calculatedAmount: 480,
              groupName: F.ORACLE_GROUP,
            },
          ],
        },
      },
      {
        productId: F.INVERTER_8KW,
        modificationId: null,
        name: 'Гібридний інвертор 8 кВт',
        price: 24500,
        quantity: 1,
        basePrice: null,
        discountData: null,
      },
      {
        productId: F.INVERTER_5KW,
        modificationId: F.INVERTER_5KW_1PH,
        name: 'Мережевий інвертор 5 кВт - Однофазний',
        price: 18300,
        quantity: 1,
        basePrice: null,
        discountData: null,
      },
    ]);
  });

  it('extraCartTotal переводить кошик через поріг знижки «від суми» — нова позиція отримує знижку', async () => {
    const battery = [line(F.BATTERY_200AH)];
    // 21000 + 28999 < 50000 — поріг не досягнуто; + 29000 = 50000 — досягнуто.
    const price = (extraCartTotal?: number) =>
      guest((db) =>
        priceItems(
          db,
          null,
          battery,
          extraCartTotal === undefined ? undefined : { extraCartTotal },
        ),
      );
    expect(unit(await price())).toEqual([[21000, null]]);
    expect(unit(await price(28999))).toEqual([[21000, null]]);
    const crossed = await price(29000);
    // Рівно та знижка, яку СТАРИЙ рушій дав кошику з трьох акумуляторів (63000) —
    // той кейс прогнано нижче окремим тестом.
    if (crossed === 'not_purchasable') throw new Error(crossed);
    expect(crossed[0]).toMatchObject({ price: 19950, basePrice: 21000 });
    expect(crossed[0].discountData).toEqual(CART_APPLIED);
  });

  it('cartTotal множить ціну на кількість: 3 акумулятори = 63000 ≥ 50000 → знижка «від суми» без extraCartTotal', async () => {
    const out = await guest((db) =>
      priceItems(db, null, [line(F.BATTERY_200AH, 3)]),
    );
    if (out === 'not_purchasable') throw new Error(out);
    expect(out[0]).toMatchObject({
      price: 19950,
      basePrice: 21000,
      quantity: 3,
    });
    expect(out[0].discountData).toEqual(CART_APPLIED);
  });

  it('покупець із категорією отримує свій тип ціни; гість — дефолтний', async () => {
    const station = [line(F.STATION_10KWH)];
    expect(unit(await guest((db) => priceItems(db, null, station)))).toEqual([
      [68000, null],
    ]);
    const customer = await withActor(
      { role: 'app_user', userId: ids.wholesale },
      (db) => priceItems(db, ids.wholesale, station),
    );
    expect(unit(customer)).toEqual([[F.WHOLESALE_STATION_PRICE, null]]);
  });
});
