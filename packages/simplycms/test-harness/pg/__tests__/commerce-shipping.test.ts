// `simplycms/commerce` (К3-Е5б, Task 1): перевірка доставки, розщеплена на
// `validateShippingChoice` + `quoteShippingCost`, — її кличуть і чекаут, і
// адмінка. Паритет із чекаутом і НЕЗМІННИЙ пріоритет відмов `prepareCheckout`
// (доставка → точка → товар) доводяться тут; рушій цін — `commerce-pricing`.
import { describe, expect, it } from 'vitest';
import type { PlaceOrderInput } from 'simplycms/contracts';
import { quoteShippingCost, validateShippingChoice } from 'simplycms/commerce';
import { prepareCheckout } from 'simplycms/storefront/loaders';
import * as F from './fixtures/commerce';
import { guest, line, useCommerceDb } from './fixtures/commerce-db';

describe('доставка commerce', () => {
  const ids = useCommerceDb('simplycms_commerce_shipping');
  const check = (
    methodId: string | null,
    deliveryCity: string | null,
    pickupPointId: string | null,
  ) =>
    guest((db) =>
      validateShippingChoice(db, {
        methodId,
        deliveryCity,
        deliveryAddress: null,
        pickupPointId,
      }),
    );

  it('quoteShippingCost: free_from від subtotal → 0; нижче min_order_amount → null; validateShippingChoice з methodId null → shipping_unavailable', async () => {
    const choice = await check(ids.courier, 'Одеса', null);
    if (typeof choice === 'string') throw new Error(choice);
    expect(choice.method.code).toBe(F.COURIER_CODE);
    expect(quoteShippingCost(choice, F.COURIER_FREE_FROM)).toEqual({
      cost: 0,
      pricing: 'rates',
    });
    expect(quoteShippingCost(choice, 5000)?.cost).toBe(F.COURIER_BASE);
    expect(quoteShippingCost(choice, F.COURIER_MIN_ORDER - 1)).toBeNull();
    expect(await check(null, 'Одеса', null)).toBe('shipping_unavailable');
  });

  it('пріоритет відмов чекауту незмінний: невалідна доставка І неможливий до купівлі товар одночасно → shipping_unavailable (як до переїзду)', async () => {
    const order = (o: Partial<PlaceOrderInput>) =>
      ({
        shippingMethodId: ids.hidden,
        deliveryCity: null,
        pickupPointId: null,
        items: [line(F.PANEL_550)],
        ...o,
      }) as PlaceOrderInput;
    const prepare = (o: Partial<PlaceOrderInput>) =>
      guest((db) => prepareCheckout(db, order(o), null));
    expect(await prepare({})).toEqual({
      ok: false,
      reason: 'shipping_unavailable',
    });
    expect(await prepare({ shippingMethodId: ids.pickup })).toEqual({
      ok: false,
      reason: 'pickup_point_invalid',
    });
    expect(
      await prepare({ shippingMethodId: ids.pickup, pickupPointId: ids.point }),
    ).toEqual({ ok: false, reason: 'not_purchasable' });
    // Успіх несе `method` — `place-order.ts` читає з нього `code`.
    expect(
      await prepare({
        shippingMethodId: ids.pickup,
        pickupPointId: ids.point,
        items: [line(F.INVERTER_8KW)],
      }),
    ).toMatchObject({
      ok: true,
      subtotal: 24500,
      shippingCost: 0,
      total: 24500,
      method: { id: ids.pickup, code: 'pickup' },
    });
  });

  it('validateShippingChoice паритет із чекаутом: pickup з deliveryCity null і активною точкою → тариф; pickup з неактивною точкою → pickup_point_invalid; не-pickup без міста → shipping_unavailable; метод деактивовано → shipping_unavailable', async () => {
    const pickup = await check(ids.pickup, null, ids.point);
    if (typeof pickup === 'string') throw new Error(pickup);
    expect(pickup.zone?.is_default).toBe(true);
    expect(quoteShippingCost(pickup, 1)?.cost).toBe(0);
    expect(await check(ids.pickup, null, ids.closed)).toBe(
      'pickup_point_invalid',
    );
    expect(await check(ids.courier, null, null)).toBe('shipping_unavailable');
    expect(await check(ids.courier, 'Одеса', ids.point)).toBe(
      'pickup_point_invalid',
    );
    expect(await check(ids.hidden, 'Одеса', null)).toBe('shipping_unavailable');
  });
});
