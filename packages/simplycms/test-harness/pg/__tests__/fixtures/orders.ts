// Фікстури харнес-тесту замовлень адмінки (Е5, Task 4): оформлення тим самим
// шляхом, що й вітрина (`placeOrderFor`), колонкові гранти — SQL-доказ `omit`
// (Е5-7), і спостерігач локів для доказу «операція стоїть САМЕ на локу
// замовлення».
import type { PlaceOrderInput } from 'simplycms/contracts';
import { placeOrderFor } from 'simplycms/storefront/loaders';
import { queryRows } from '../../apply.mjs';

export const orderInput = (
  shippingMethodId: string,
  pickupPointId: string,
  items: { productId: string; quantity: number }[],
): PlaceOrderInput => ({
  firstName: 'Тест',
  lastName: 'Покупець',
  email: 'buyer@example.test',
  phone: '+380000000000',
  shippingMethodId,
  deliveryCity: null,
  deliveryAddress: null,
  pickupPointId,
  paymentMethod: 'cash',
  notes: null,
  hasDifferentRecipient: false,
  recipientFirstName: null,
  recipientLastName: null,
  recipientPhone: null,
  recipientEmail: null,
  recipientCity: null,
  recipientAddress: null,
  recipientNotes: null,
  saveRecipient: false,
  savedRecipientId: null,
  savedAddressId: null,
  items: items.map((i) => ({ ...i, modificationId: null })),
});

/**
 * Вхід оформлення на демо-сіді (Е6в, Task 6): самовивіз зі «Склад у Києві»,
 * 1 шт товару без обліку залишку — оформлювати можна скільки завгодно разів.
 */
export const demoPickupInput = async (
  dbUrl: string,
  slug = 'invertor-gibrydnyi-8kw',
): Promise<PlaceOrderInput> => {
  const id = async (sql: string, p: unknown[] = []) =>
    ((await queryRows(dbUrl, sql, p)) as { id: string }[])[0]!.id;
  return orderInput(
    await id(`select id from public.shipping_methods where code = 'pickup'`),
    await id(
      `select id from public.pickup_points where name = 'Склад у Києві'`,
    ),
    [
      {
        productId: await id(`select id from public.products where slug = $1`, [
          slug,
        ]),
        quantity: 1,
      },
    ],
  );
};

/** Оформлення справжньою воронкою вітрини; повертає id замовлення. */
export const placeOrder = async (
  input: PlaceOrderInput,
  userId: string | null = null,
): Promise<string> => {
  const result = await placeOrderFor(input, userId);
  if (!result.ok)
    throw new Error(`[harness] оформлення відмовлено: ${result.reason}`);
  return result.order.id;
};

/**
 * 🔴 SQL-доказ `omit` (Е5-7): у ТИМЧАСОВІЙ БД тесту `app_admin` втрачає
 * табличний SELECT на `orders` і отримує колонковий — на всі колонки, КРІМ
 * `access_token`. Канон грантів (`0002_grants.sql`) не змінюється. Після
 * цього будь-яка проєкція з `access_token` (SELECT або RETURNING) дає 42501.
 */
export const restrictOrdersSelectForAdmin = async (dbUrl: string) => {
  const cols = (await queryRows(
    dbUrl,
    `select column_name from information_schema.columns
      where table_schema = 'public' and table_name = 'orders'
        and column_name <> 'access_token' order by ordinal_position`,
  )) as { column_name: string }[];
  const list = cols.map((c) => `"${c.column_name}"`).join(', ');
  await queryRows(dbUrl, `revoke select on public.orders from app_admin`);
  await queryRows(
    dbUrl,
    `grant select (${list}) on public.orders to app_admin`,
  );
};

/**
 * Опитує `pg_stat_activity` до дедлайну, поки не зʼявиться бекенд, який
 * блокує САМЕ `holderPid` (привʼязка через `pg_blocking_pids`, а не «будь-хто,
 * хто чекає»). Повертає pid і текст запиту, на якому він стоїть.
 */
export const waitForBlockedBy = async (
  dbUrl: string,
  holderPid: number,
  deadlineMs = 5_000,
  stepMs = 25,
): Promise<{ pid: number; query: string }> => {
  const until = Date.now() + deadlineMs;
  while (Date.now() < until) {
    const rows = (await queryRows(
      dbUrl,
      `select pid, query from pg_stat_activity
        where datname = current_database() and $1 = any(pg_blocking_pids(pid))`,
      [holderPid],
    )) as { pid: number; query: string }[];
    if (rows.length > 0) return rows[0]!;
    await new Promise((r) => setTimeout(r, stepMs));
  }
  throw new Error(
    `[harness] за ${deadlineMs} мс ніхто не став на лок ${holderPid}`,
  );
};

/** Кількість row-локів бекенду `pid` на позиціях і залишках. */
export const rowLocksOnStock = async (
  dbUrl: string,
  pid: number,
): Promise<number> =>
  (
    (await queryRows(
      dbUrl,
      `select count(*)::int as c from pg_locks l join pg_class c on c.oid = l.relation
        where l.pid = $1 and c.relname in ('order_items', 'stock_by_pickup_point')
          and l.mode in ('RowExclusiveLock', 'RowShareLock')`,
      [pid],
    )) as { c: number }[]
  )[0]!.c;
