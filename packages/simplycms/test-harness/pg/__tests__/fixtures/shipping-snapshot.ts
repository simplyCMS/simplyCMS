// Сід харнес-тестів знімка доставки (К3-Е6а): адресний спосіб «за тарифами
// перевізника» і вхід курʼєрського оформлення — спільні для shipping-snapshot*.
import type { PlaceOrderInput } from 'simplycms/contracts';
import { orderInput } from './orders';
import type { useOrderItemsEditDb } from './order-items-edit';

type Db = ReturnType<typeof useOrderItemsEditDb>;

/** Адресний спосіб `carrier` — І з тарифом 999 у дефолтній зоні, який не має
 *  діяти, доки спосіб не переведуть на `rates`. Окремий `code` — окремий
 *  спосіб: кейс, що змінює спосіб, не зачіпає сусідів. */
export const carrierMethod = async (
  f: Db,
  code = 'e6a-carrier',
): Promise<string> => {
  const [row] = await f.rows<{ id: string }>(
    `insert into public.shipping_methods (id, code, name, is_active, provider, pricing)
     values (gen_random_uuid(), $1, 'Перевізник', true, 'core:address', 'carrier')
     on conflict (code) do update set name = excluded.name returning id`,
    [code],
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

export const courierInput = (f: Db, methodId: string): PlaceOrderInput => ({
  ...orderInput(methodId, '', [{ productId: f.ids.panel, quantity: 1 }]),
  pickupPointId: null,
  deliveryCity: 'Київ',
  deliveryAddress: 'вул. Тестова, 1',
});

/** `orders.shipping_data` замовлення. */
export const shippingDataOf = async (f: Db, orderId: string) =>
  (
    await f.rows<{ shippingData: unknown }>(
      `select shipping_data as "shippingData" from public.orders where id = $1`,
      [orderId],
    )
  )[0]!.shippingData;
