// Реєстр ПД `orders` (Е6г-7): звірка зі схемою БД і поведінка
// `eraseOrderPersonalData` (нова `personal` колонка стирається без правок).
import { getTableColumns } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import {
  ORDER_COLUMN_PRIVACY,
  eraseOrderPersonalData,
} from 'simplycms/commerce';
import { withActor } from 'simplycms/db';
import { orders } from 'simplycms/schema';
import {
  loadOrderDetail,
  withCustomerDb,
  withOrderTokenDb,
} from 'simplycms/storefront/loaders';
import * as F from './fixtures/customer-categories';

const dbColumn = (key: string): string =>
  (getTableColumns(orders) as Record<string, { name: string }>)[key]!.name;

const addressSnapshot = (destination: object) => ({
  methodName: 'Кур’єр',
  provider: 'core:address',
  pricing: 'carrier',
  destination,
});
const POINT = {
  kind: 'pickup-point',
  pointId: 'p1',
  name: 'Склад',
  address: 'вул. Сонячна, 1',
  city: 'Київ',
};

describe('реєстр ПД orders', () => {
  const db = F.useCustomersDb('simplycms_order_privacy');
  const url = () => db.url();

  it('множина колонок orders в БД = колонки з ключів реєстру', async () => {
    const live = (
      (await F.rows(
        url(),
        `select column_name from information_schema.columns
          where table_schema = 'public' and table_name = 'orders'`,
      )) as { column_name: string }[]
    )
      .map((r) => r.column_name)
      .sort();
    const registry = Object.keys(ORDER_COLUMN_PRIVACY).map(dbColumn).sort();
    expect(registry).toEqual(live);
  });

  it('знеособлення: три замовлення покупця стерті, чуже незмінне', async () => {
    const buyer = await F.seedCustomer(url());
    const other = await F.seedCustomer(url());
    const addressId = crypto.randomUUID();
    const recipientId = crypto.randomUUID();
    await F.rows(
      url(),
      `insert into public.user_addresses (id, user_id, name, city, address)
         values ($1, $2, 'Дім', 'Київ', 'вул. 1')`,
      [addressId, buyer],
    );
    await F.rows(
      url(),
      `insert into public.user_recipients (id, user_id, first_name, last_name, phone, city, address)
         values ($1, $2, 'О', 'Т', '+380', 'Київ', 'вул. 3')`,
      [recipientId, buyer],
    );
    const seed = async (user: string, tag: string, shipping: unknown) => {
      const id = crypto.randomUUID();
      await F.rows(
        url(),
        `insert into public.orders
           (id, user_id, order_number, first_name, last_name, email, phone,
            delivery_address, delivery_city, notes, payment_method, subtotal, total,
            access_token, shipping_data, has_different_recipient, recipient_first_name,
            recipient_last_name, recipient_phone, recipient_email,
            saved_address_id, saved_recipient_id)
         values ($1, $2, $3, 'Ім', 'Пр', 'e@x.test', '+38', 'вул. 1', 'Київ', 'нотатка',
                 'cash', 10, 10, $4, $5::jsonb, true, 'Р', 'П', '+39', 'r@x.test', $6, $7)`,
        [
          id,
          user,
          `PR-${tag}-${id.slice(0, 6)}`,
          `tok-${id}`,
          JSON.stringify(shipping),
          user === buyer ? addressId : null,
          user === buyer ? recipientId : null,
        ],
      );
      return id;
    };
    const address = addressSnapshot({
      kind: 'address',
      city: 'Львів',
      address: 'вул. 5',
    });
    const point = addressSnapshot(POINT);
    const broken = {};
    const ids = [
      await seed(buyer, 'a', address),
      await seed(buyer, 'p', point),
      await seed(buyer, 'b', broken),
    ];
    const foreign = await seed(other, 'f', address);
    const row = async (id: string) =>
      (
        await F.rows(url(), `select * from public.orders where id = $1`, [id])
      )[0] as Record<string, unknown>;
    const foreignBefore = await row(foreign);
    const pointBefore = (await row(ids[1]!)).shipping_data;

    const detail = (id: string, token: string) =>
      withOrderTokenDb(token, (tx) => loadOrderDetail(tx, id));
    // До стирання гість із токеном читає замовлення (контроль для «після»).
    expect((await detail(ids[0]!, `tok-${ids[0]}`))?.email).toBe('e@x.test');

    const now = new Date('2026-10-08T10:00:00Z');
    const erased = await withActor({ role: 'app_admin' }, (tx) =>
      eraseOrderPersonalData(tx, buyer, now),
    );
    expect(erased).toBe(3);

    for (const id of ids) {
      const r = await row(id);
      expect(r.personal_data_erased_at).toEqual(now);
      for (const [key, kind] of Object.entries(ORDER_COLUMN_PRIVACY)) {
        if (kind !== 'personal' || key === 'shippingData') continue;
        expect(r[dbColumn(key)], key).toBeNull();
      }
    }
    expect((await row(ids[0]!)).shipping_data).toEqual({
      ...address,
      destination: { kind: 'address', city: null, address: null },
    });
    expect((await row(ids[1]!)).shipping_data).toEqual(pointBefore);
    expect((await row(ids[2]!)).shipping_data).toEqual({});
    expect(await row(foreign)).toEqual(foreignBefore);

    // Е6г-17: `loadOrderDetail` стерте не фільтрує, але недосяжне за побудовою —
    // старий токен і колишній власник замовлення вже не бачать.
    for (const id of ids) {
      expect(await detail(id, `tok-${id}`)).toBeNull();
      expect(
        await withCustomerDb(buyer, (tx) => loadOrderDetail(tx, id)),
      ).toBeNull();
    }
  });
});
