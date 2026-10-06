// К3-Е6а, Task 2: режим ціни, провайдери й знімок доставки в замовленні.
// Оформлення — воронкою вітрини (`placeOrderFor`/`quoteCheckoutFor`), редагування
// позицій — іменованою операцією адмінки; усе на одній БД контуру Е5б.
import { describe, expect, it, vi } from 'vitest';
import type { PlaceOrderInput } from 'simplycms/contracts';
import { placeOrderFor, quoteCheckoutFor } from 'simplycms/storefront/loaders';
import { orderInput } from './fixtures/orders';
import { useOrderItemsEditDb } from './fixtures/order-items-edit';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: null, roles: ['admin'] },
    scope: 'any',
  })),
}));

describe('доставка: режим ціни й знімок у замовленні (К3-Е6а, Task 2)', () => {
  const f = useOrderItemsEditDb('simplycms_e6a_snapshot');
  const { ids } = f;

  /** Адресний спосіб «за тарифами перевізника» — І з тарифом, який не має діяти. */
  const carrier = async (): Promise<string> => {
    const [row] = await f.rows<{ id: string }>(
      `insert into public.shipping_methods (id, code, name, is_active, provider, pricing)
       values (gen_random_uuid(), 'e6a-carrier', 'Перевізник', true, 'core:address', 'carrier')
       on conflict (code) do update set name = excluded.name returning id`,
    );
    await f.rows(
      `insert into public.shipping_rates (id, method_id, zone_id, name, calculation_type, base_cost, is_active, sort_order)
       select gen_random_uuid(), $1, z.id, 'Ігнорований тариф', 'flat', 999, true, 0
         from public.shipping_zones z
        where z.is_default = true
          and not exists (select 1 from public.shipping_rates where method_id = $1)`,
      [row!.id],
    );
    return row!.id;
  };
  const courierInput = (methodId: string): PlaceOrderInput => ({
    ...orderInput(methodId, '', [{ productId: ids.panel, quantity: 1 }]),
    pickupPointId: null,
    deliveryCity: 'Київ',
    deliveryAddress: 'вул. Тестова, 1',
  });
  const dataOf = async (orderId: string) =>
    (
      await f.rows<{ shippingData: unknown; cols: string[] }>(
        `select shipping_data as "shippingData",
              (select array_agg(column_name::text) from information_schema.columns
                where table_schema = 'public' and table_name = 'orders'
                  and column_name = 'delivery_method') as cols
         from public.orders where id = $1`,
        [orderId],
      )
    )[0]!;

  it('(а)(д) самовивіз: shipping_data = знімок із назвою й адресою точки, колонки delivery_method немає, перейменування точки знімок не міняє', async () => {
    const orderId = await f.place([{ productId: ids.panel, quantity: 1 }]);
    const [point] = await f.rows<{
      name: string;
      address: string;
      city: string;
    }>(`select name, address, city from public.pickup_points where id = $1`, [
      ids.point,
    ]);
    const expected = {
      methodName: 'Самовивіз',
      provider: 'core:pickup',
      pricing: 'rates',
      destination: {
        kind: 'pickup-point',
        pointId: ids.point,
        name: point!.name,
        address: point!.address,
        city: point!.city,
      },
    };
    const row = await dataOf(orderId);
    expect(row.shippingData).toEqual(expected);
    expect(row.cols).toBeNull();

    await f.rows(
      `update public.pickup_points set name = 'Інша' where id = $1`,
      [ids.point],
    );
    expect((await dataOf(orderId)).shippingData).toEqual(expected);
    await f.rows(`update public.pickup_points set name = $2 where id = $1`, [
      ids.point,
      point!.name,
    ]);
  });

  it('(б) адресний carrier: shipping_cost 0, total = subtotal, знімок kind address', async () => {
    const method = await carrier();
    const result = await placeOrderFor(courierInput(method), null);
    if (!result.ok) throw new Error(result.reason);
    const [row] = await f.rows<{
      subtotal: string;
      cost: string;
      total: string;
    }>(
      `select subtotal::text, shipping_cost::text as cost, total::text from public.orders where id = $1`,
      [result.order.id],
    );
    expect(row!.cost).toBe('0.00');
    expect(row!.total).toBe(row!.subtotal);
    expect((await dataOf(result.order.id)).shippingData).toEqual({
      methodName: 'Перевізник',
      provider: 'core:address',
      pricing: 'carrier',
      destination: {
        kind: 'address',
        city: 'Київ',
        address: 'вул. Тестова, 1',
      },
    });
  });

  it('(в) точка ІНШОГО способу самовивозу → pickup_point_invalid', async () => {
    const [other] = await f.rows<{ id: string }>(
      `insert into public.shipping_methods (id, code, name, is_active, provider)
       values (gen_random_uuid(), 'e6a-pickup-2', 'Самовивіз 2', true, 'core:pickup') returning id`,
    );
    const input = orderInput(other!.id, ids.point, [
      { productId: ids.panel, quantity: 1 },
    ]);
    expect(await placeOrderFor(input, null)).toEqual({
      ok: false,
      reason: 'pickup_point_invalid',
    });
  });

  it('(г) recomputeOrderTotals для carrier після зміни кількості → shipping_cost 0', async () => {
    const method = await carrier();
    const result = await placeOrderFor(courierInput(method), null);
    if (!result.ok) throw new Error(result.reason);
    const orderId = result.order.id;
    const item = await f.itemOf(orderId, ids.panel);
    const { order } = await f.setQty(orderId, item, 3);
    expect(order).toMatchObject({ shippingCost: '0.00' });
    const sums = await f.sums(orderId);
    expect(sums.shippingCost).toBe('0.00');
    expect(sums.total).toBe(sums.subtotal);
  });

  it('(е) quoteCheckoutFor для carrier: shippingPricing carrier, shippingCost 0; для тарифного способу — rates', async () => {
    const method = await carrier();
    const quoted = await quoteCheckoutFor(courierInput(method), null);
    if (!quoted.ok) throw new Error(quoted.reason);
    expect(quoted.quote.shippingPricing).toBe('carrier');
    expect(quoted.quote.shippingCost).toBe(0);
    const rated = await quoteCheckoutFor(courierInput(ids.fixed), null);
    if (!rated.ok) throw new Error(rated.reason);
    expect(rated.quote.shippingPricing).toBe('rates');
    expect(rated.quote.shippingCost).toBe(70.1);
  });
});
