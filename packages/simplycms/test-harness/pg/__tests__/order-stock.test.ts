// Write-side правила наявності (К2-Е0, Е0-3) ПОВЕРХ покупного демо-сіду
// (Task 7): метод `pickup`, СИСТЕМНА точка «Склад у Києві», залишки 450w=5 і
// 550w=3, decrease_on_order=true — з сіду; тест додає лише те, чого сід не має
// (дві власні точки для перевірки «одна точка, а не сума», залишки для товарів
// без сідового обліку, і два товари для рішень архітектора B/L — `on_order`
// і реальний `NULL` у `stock_status`).
//
// 🔴 Рев'ю (Opus) до цього файлу додало ще чотири кейси (кожен заводить
// ВЛАСНУ точку й самодостатній, щоб не мішати стан зі спільними
// POINT_A/POINT_B): I1 — деактивована точка не губить залишок на
// поверненні; I2 — та сама пара «списання/повернення» на МОДИФІКАЦІЇ, не
// лише простому товарі; I3 — подвійне скасування повертає залишок рівно
// ОДИН раз (гвард `lockOrderStatus`); M4 — реальний `NULL` фліпається у
// `out_of_stock` write-side, не лише читається як доступний.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDbPool } from 'simplycms/db';
import {
  InsufficientStockError,
  createOrder,
  loadOrderDetail,
  loadStockInfo,
  lockOrderStatus,
  releaseOrderStock,
  setOrderStatus,
  withOrderTokenDb,
  withStorefrontDb,
  type NewOrderInput,
  type OperatorEscalation,
} from 'simplycms/storefront/loaders';
import { resolveHarness } from '../up.mjs';
import {
  applySqlFiles,
  createTempDatabase,
  dropTempDatabase,
  queryRows,
  randomDbName,
  withDbName,
  withUser,
} from '../apply.mjs';

const MIGRATIONS_DIR = join(import.meta.dirname, '../../../migrations');
/** Панель із сідовим залишком 5 на системній точці. */
const SEEDED_SLUG = 'sonyachna-panel-450w-mono';
/** Панель із сідовим залишком 3 — оформлення й скасування. */
const CANCEL_SLUG = 'sonyachna-panel-550w-mono';
/** Панель без сідового залишку — залишки на ДВОХ тестових точках. */
const TWO_POINTS_SLUG = 'sonyachna-panel-600w-bifacial';
/** Товари без сідового залишку — конкурентні кейси (на системній точці). */
const RACE_SLUG = 'stantsiya-nakopychennya-10kwh';
const FLIP_RACE_SLUG = 'akumulyator-lifepo4-200ah';
/** Товар без жодного рядка залишків — обліку немає. */
const UNTRACKED_SLUG = 'invertor-gibrydnyi-8kw';
/** Залишки на СИСТЕМНІЙ і на тестовій точці — третя ланка правила точки. */
const FALLBACK_SLUG = 'akumulyator-lifepo4-100ah';
/**
 * Сідовий товар БЕЗ жодного власного тесту вище — переводиться на реальний
 * `NULL` у `stock_status` (борг рев'ю Task 8: доти правило `null → in_stock`
 * було доведено лише чистою функцією `isPurchasable`, не межею лоадера).
 */
const NULL_STATUS_SLUG = 'invertor-merezhevyi-5kw';
/** Товар «під замовлення» (рішення архітектора B) — демо-сід такого не має. */
const ON_ORDER_SLUG = 'test-on-order-status';
// sort_order 10/11 — свідомо ДАЛІ за сідову точку (0): порядок показу без тайів.
const POINT_A = 'Тестова точка A';
const POINT_B = 'Тестова точка B';

interface IdRow {
  id: string;
}
interface QtyRow {
  quantity: number;
}
interface StatusRow {
  stock_status: string | null;
}

const baseInput = (
  productId: string,
  quantity: number,
  methodId: string,
  pickupPointId: string | null,
): NewOrderInput => ({
  firstName: 'Тест',
  lastName: 'Покупець',
  email: 'buyer@example.test',
  phone: '+380000000000',
  shippingMethodId: methodId,
  deliveryCity: null,
  deliveryAddress: null,
  pickupPointId,
  paymentMethod: 'cash',
  notes: null,
  subtotal: 100 * quantity,
  shippingCost: 0,
  total: 100 * quantity,
  hasDifferentRecipient: false,
  recipientFirstName: null,
  recipientLastName: null,
  recipientPhone: null,
  recipientEmail: null,
  savedRecipientId: null,
  savedAddressId: null,
  items: [
    {
      productId,
      modificationId: null,
      name: 'Позиція',
      price: 100,
      quantity,
      basePrice: null,
      discountData: null,
    },
  ],
});

describe('замовлення списує залишок і повертає його при скасуванні', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_order_stock');
  let dbUrl = '';
  let methodId = '';
  let pointA = '';
  const ids: Record<string, string> = {};

  const idOf = async (slug: string): Promise<string> =>
    (
      (await queryRows(
        dbUrl,
        `select id from public.products where slug = $1`,
        [slug],
      )) as IdRow[]
    )[0].id;
  const quantities = async (productId: string): Promise<number[]> =>
    (
      (await queryRows(
        dbUrl,
        `select s.quantity from public.stock_by_pickup_point s
         join public.pickup_points pp on pp.id = s.pickup_point_id
        where s.product_id = $1 order by pp.sort_order, s.id`,
        [productId],
      )) as QtyRow[]
    ).map((r) => Number(r.quantity));
  const statusOf = async (productId: string): Promise<string | null> =>
    (
      (await queryRows(
        dbUrl,
        `select stock_status from public.products where id = $1`,
        [productId],
      )) as StatusRow[]
    )[0].stock_status;
  const ordersCount = async (): Promise<number> =>
    (
      (await queryRows(
        dbUrl,
        `select count(*)::int as c from public.orders`,
      )) as { c: number }[]
    )[0].c;
  const place = (
    productId: string,
    quantity: number,
    pickupPointId: string | null = null,
  ) => {
    const token = crypto.randomUUID();
    return withOrderTokenDb(token, (db, operator) =>
      createOrder(
        db,
        null,
        token,
        baseInput(productId, quantity, methodId, pickupPointId),
        operator,
      ),
    );
  };

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applySqlFiles(dbUrl, [
      ...readdirSync(MIGRATIONS_DIR)
        .filter((n) => n.endsWith('.sql'))
        .sort()
        .map((n) => join(MIGRATIONS_DIR, n)),
      join(MIGRATIONS_DIR, 'demo/demo-seed.sql'),
    ]);
    [{ id: methodId }] = (await queryRows(
      dbUrl,
      `select id from public.shipping_methods where code = 'pickup'`,
    )) as IdRow[];
    const [{ id: systemPointId }] = (await queryRows(
      dbUrl,
      `select id from public.pickup_points where is_system`,
    )) as IdRow[];
    for (const slug of [
      SEEDED_SLUG,
      CANCEL_SLUG,
      TWO_POINTS_SLUG,
      RACE_SLUG,
      FLIP_RACE_SLUG,
      UNTRACKED_SLUG,
      FALLBACK_SLUG,
      NULL_STATUS_SLUG,
    ])
      ids[slug] = await idOf(slug);
    await queryRows(
      dbUrl,
      `insert into public.pickup_points (id, method_id, name, address, city, is_active, sort_order)
       values (gen_random_uuid(), $1, '${POINT_A}', 'вул. А, 1', 'Київ', true, 10),
              (gen_random_uuid(), $1, '${POINT_B}', 'вул. Б, 2', 'Київ', true, 11)`,
      [methodId],
    );
    [{ id: pointA }] = (await queryRows(
      dbUrl,
      `select id from public.pickup_points where name = '${POINT_A}'`,
    )) as IdRow[];
    // Конкурентні кейси — на СИСТЕМНІЙ точці (замовлення без самовивозу
    // резолвиться саме туди); двоточковий кейс — на тестових точках; кейс
    // третьої ланки правила — на обох одразу, щоб було видно, ЯКУ з активних
    // точок вибрав резолв, коли системної немає.
    await queryRows(
      dbUrl,
      `insert into public.stock_by_pickup_point (id, pickup_point_id, product_id, modification_id, quantity)
       select gen_random_uuid(), pp.id, v.product_id::uuid, null, v.quantity
         from (values ($1, '${POINT_A}', 3), ($1, '${POINT_B}', 2), ($2, 'SYSTEM', 3),
                      ($3, 'SYSTEM', 2), ($4, 'SYSTEM', 2), ($4, '${POINT_A}', 2))
              as v(product_id, point_name, quantity)
         join public.pickup_points pp
           on (v.point_name = 'SYSTEM' and pp.is_system) or pp.name = v.point_name`,
      [
        ids[TWO_POINTS_SLUG],
        ids[RACE_SLUG],
        ids[FLIP_RACE_SLUG],
        ids[FALLBACK_SLUG],
      ],
    );

    // 🔴 Борг рев'ю Task 8: реальний `NULL` у `stock_status` (не «рядка
    // немає») — товар уже вставлений сідом зі значенням `'in_stock'`
    // (літерал у `demo-seed.sql`, не DEFAULT), тож NULL тут можливий лише
    // явним UPDATE.
    await queryRows(
      dbUrl,
      `update public.products set stock_status = null where id = $1`,
      [ids[NULL_STATUS_SLUG]],
    );

    // 🔴 Рішення архітектора B: ціль «під замовлення» — демо-сід такої не
    // має, тож заводимо окремий товар з обліком 0 на СИСТЕМНІЙ точці.
    const onOrderId = crypto.randomUUID();
    await queryRows(
      dbUrl,
      `insert into public.products (id, slug, name, stock_status) values ($1, $2, 'Тест on_order', 'on_order')`,
      [onOrderId, ON_ORDER_SLUG],
    );
    await queryRows(
      dbUrl,
      `insert into public.stock_by_pickup_point (id, pickup_point_id, product_id, modification_id, quantity)
       values (gen_random_uuid(), $1, $2, null, 0)`,
      [systemPointId, onOrderId],
    );
    ids[ON_ORDER_SLUG] = onOrderId;

    process.env.DATABASE_URL = withUser(dbUrl, 'app_runtime');
  }, 120_000);

  afterAll(async () => {
    await closeDbPool();
    // 🔴 Ключ прибирається, як у решті 15 харнес-тестів: `fileParallelism:
    // false` не дає ізоляції процесу, тож лишений `DATABASE_URL` тек би в
    // наступний файл сюїти.
    delete process.env.DATABASE_URL;
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  it('передумова: демо-сід вмикає облік', async () => {
    const [{ value }] = (await queryRows(
      dbUrl,
      `select value from public.system_settings where key = 'stock_management'`,
    )) as { value: { decrease_on_order: boolean } }[];
    expect(value.decrease_on_order).toBe(true);
  });

  it('передумова: демо-сід має рівно одну СИСТЕМНУ точку', async () => {
    // 🔴 Саме на ній тримається крок 2 резолву: без неї замовлення без
    // самовивозу пішло б у «першу активну», тобто в довільну роздрібну точку.
    const rows = await queryRows(
      dbUrl,
      `select name from public.pickup_points where is_system`,
    );
    expect(rows).toHaveLength(1);
  });

  it('списує із сідового залишку і не чіпає статус, доки залишок є', async () => {
    const order = await place(ids[SEEDED_SLUG], 3);
    expect(order.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await quantities(ids[SEEDED_SLUG])).toEqual([2]);
    expect(await statusOf(ids[SEEDED_SLUG])).toBe('in_stock');
  });

  it('на нулі переводить статус в out_of_stock', async () => {
    await place(ids[SEEDED_SLUG], 2);
    expect(await quantities(ids[SEEDED_SLUG])).toEqual([0]);
    expect(await statusOf(ids[SEEDED_SLUG])).toBe('out_of_stock');
  });

  it('🔴 нестача — відмова, і рядка в orders НЕМАЄ (транзакція відкочена)', async () => {
    const before = await ordersCount();
    await expect(place(ids[SEEDED_SLUG], 1)).rejects.toBeInstanceOf(
      InsufficientStockError,
    );
    expect(await ordersCount()).toBe(before);
  });

  it('🔴 скасування ПОВЕРТАЄ залишок і статус: стан той самий, що до замовлення', async () => {
    const before = await quantities(ids[CANCEL_SLUG]);
    const beforeStatus = await statusOf(ids[CANCEL_SLUG]);
    const order = await place(ids[CANCEL_SLUG], 3);
    expect(await quantities(ids[CANCEL_SLUG])).toEqual([0]);
    expect(await statusOf(ids[CANCEL_SLUG])).toBe('out_of_stock');

    // Те саме, що робить `cancelMyOrder`, і в тому самому порядку: спершу
    // читання ПІД АКТОРОМ (право доводить RLS), і лише потім ескалація в тій
    // же транзакції. Сам serverFn потребує сесії Better Auth — його
    // орчестрацію тримають typecheck і live-smoke.
    await withOrderTokenDb(
      order.accessToken as string,
      async (db, operator) => {
        expect(await loadOrderDetail(db, order.id)).not.toBeNull();
        await operator((odb) => releaseOrderStock(odb, order.id));
      },
    );

    expect(await quantities(ids[CANCEL_SLUG])).toEqual(before);
    expect(await statusOf(ids[CANCEL_SLUG])).toBe(beforeStatus);
  });

  it('🔴 замовлення без самовивозу йде в СИСТЕМНУ точку: рядка там немає — відмова, а не тихий продаж', async () => {
    const before = await ordersCount();
    await expect(place(ids[TWO_POINTS_SLUG], 1)).rejects.toBeInstanceOf(
      InsufficientStockError,
    );
    expect(await ordersCount()).toBe(before);
    expect(await quantities(ids[TWO_POINTS_SLUG])).toEqual([3, 2]);
  });

  it('🔴 одна точка не збирає залишок із сусідньої: 3+2 не продасть 4', async () => {
    await expect(place(ids[TWO_POINTS_SLUG], 4, pointA)).rejects.toBeInstanceOf(
      InsufficientStockError,
    );
    expect(await quantities(ids[TWO_POINTS_SLUG])).toEqual([3, 2]);
  });

  it('списує рівно з названої точки; статус тримається СУМОЮ по точках', async () => {
    await place(ids[TWO_POINTS_SLUG], 3, pointA);
    expect(await quantities(ids[TWO_POINTS_SLUG])).toEqual([0, 2]);
    expect(await statusOf(ids[TWO_POINTS_SLUG])).toBe('in_stock');
  });

  it('🔴 два конкурентні по 2 на залишок 3 — рівно одне проходить (FOR UPDATE)', async () => {
    // Послідовні кейси зеленіли б і для «SELECT → безумовний UPDATE», який
    // оверселить при перетині транзакцій; тут дві транзакції справді перетинаються.
    const settled = await Promise.allSettled([
      place(ids[RACE_SLUG], 2),
      place(ids[RACE_SLUG], 2),
    ]);
    const ok = settled.filter((r) => r.status === 'fulfilled').length;
    const rejected = settled.filter(
      (r) =>
        r.status === 'rejected' && r.reason instanceof InsufficientStockError,
    ).length;
    expect([ok, rejected]).toEqual([1, 1]);
    expect(await quantities(ids[RACE_SLUG])).toEqual([1]);
    expect(await statusOf(ids[RACE_SLUG])).toBe('in_stock');
  });

  it('🔴 два конкурентні по 1 на залишок 2 — обидва проходять, статус out_of_stock', async () => {
    // Pre-read без блокування дав би «лишається 1» ОБОМ і жодного фліпу:
    // нуль на складі при in_stock. Саме цей кейс пінить читання під FOR UPDATE.
    const settled = await Promise.allSettled([
      place(ids[FLIP_RACE_SLUG], 1),
      place(ids[FLIP_RACE_SLUG], 1),
    ]);
    expect(settled.every((r) => r.status === 'fulfilled')).toBe(true);
    expect(await quantities(ids[FLIP_RACE_SLUG])).toEqual([0]);
    expect(await statusOf(ids[FLIP_RACE_SLUG])).toBe('out_of_stock');
  });

  it('товар без рядків залишків — обліку немає, замовлення проходить, статус не змінюється', async () => {
    const order = await place(ids[UNTRACKED_SLUG], 5);
    expect(order.orderNumber).toMatch(/^\d{6}-[0-9A-F]{6}$/);
    expect(await statusOf(ids[UNTRACKED_SLUG])).toBe('in_stock');
  });

  it("🔴 NULL реальний у stock_status: лоадер читання вважає ціль доступною (борг рев'ю Task 8)", async () => {
    // Не «рядка немає» (undefined у loadStockStatus), а САМЕ NULL у наявному
    // рядку — DEFAULT схеми такий самий, тож isPurchasable(null) === true
    // (Task 8) мусить лишитись правдивим і на межі лоадера, не лише в чистій
    // функції.
    const info = await withStorefrontDb((db) =>
      loadStockInfo(db, { productId: ids[NULL_STATUS_SLUG] }),
    );
    expect(info.stockStatus).toBeNull();
    expect(info.isAvailable).toBe(true);
  });

  it('🔴 on_order: достатність не перевіряється, залишок може стати відʼємним (рішення архітектора B)', async () => {
    const order = await place(ids[ON_ORDER_SLUG], 1);
    // Облік був 0 — списання йде як є, а не InsufficientStockError.
    expect(await quantities(ids[ON_ORDER_SLUG])).toEqual([-1]);
    // `on_order` не фліпається — `setTargetStatus` гвардований проти нього.
    expect(await statusOf(ids[ON_ORDER_SLUG])).toBe('on_order');

    await withOrderTokenDb(
      order.accessToken as string,
      async (db, operator) => {
        await operator((odb) => releaseOrderStock(odb, order.id));
      },
    );
    expect(await quantities(ids[ON_ORDER_SLUG])).toEqual([0]);
    expect(await statusOf(ids[ON_ORDER_SLUG])).toBe('on_order');
  });

  it('🔴 I1: точку ДЕАКТИВУВАЛИ між замовленням і скасуванням — залишок повертається', async () => {
    // Власна точка й товар — сценарій самодостатній, не займає стан
    // POINT_A/POINT_B, яким послуговуються сусідні кейси.
    const [{ id: pointId }] = (await queryRows(
      dbUrl,
      `insert into public.pickup_points (id, method_id, name, address, city, is_active, sort_order)
       values (gen_random_uuid(), $1, 'Тестова точка I1', 'вул. І1, 1', 'Київ', true, 20)
       returning id`,
      [methodId],
    )) as IdRow[];
    const productId = crypto.randomUUID();
    await queryRows(
      dbUrl,
      `insert into public.products (id, slug, name) values ($1, 'test-i1-deactivated-point', 'Тест I1')`,
      [productId],
    );
    await queryRows(
      dbUrl,
      `insert into public.stock_by_pickup_point (id, pickup_point_id, product_id, modification_id, quantity)
       values (gen_random_uuid(), $1, $2, null, 5)`,
      [pointId, productId],
    );

    const order = await place(productId, 3, pointId);
    expect(await quantities(productId)).toEqual([2]);

    // Магазин деактивує точку ПІСЛЯ оформлення. Рядок залишку і далі існує —
    // деактивація не каскадить (лише ВИДАЛЕННЯ точки прибирає рядок).
    await queryRows(
      dbUrl,
      `update public.pickup_points set is_active = false where id = $1`,
      [pointId],
    );

    await withOrderTokenDb(
      order.accessToken as string,
      async (db, operator) => {
        await operator((odb) => releaseOrderStock(odb, order.id));
      },
    );

    // Без `includePointId` у `lockTargetStock` рядок ховав той самий предикат
    // «обслуговуючих» точок, і `releaseStock` мовчки виходив на «рядка немає»
    // — залишок лишився б [2] назавжди.
    expect(await quantities(productId)).toEqual([5]);
  });

  it('🔴 I2: списання й повернення працюють так само для МОДИФІКАЦІЇ, не лише простого товару', async () => {
    const [{ id: modificationId }] = (await queryRows(
      dbUrl,
      `select id from public.product_modifications where slug = 'chornyi' and product_id = $1`,
      [ids[FALLBACK_SLUG]],
    )) as IdRow[];
    const [{ id: pointId }] = (await queryRows(
      dbUrl,
      `insert into public.pickup_points (id, method_id, name, address, city, is_active, sort_order)
       values (gen_random_uuid(), $1, 'Тестова точка I2', 'вул. І2, 1', 'Київ', true, 21)
       returning id`,
      [methodId],
    )) as IdRow[];
    await queryRows(
      dbUrl,
      `insert into public.stock_by_pickup_point (id, pickup_point_id, product_id, modification_id, quantity)
       values (gen_random_uuid(), $1, null, $2, 2)`,
      [pointId, modificationId],
    );

    const modQuantity = async (): Promise<number> =>
      (
        (await queryRows(
          dbUrl,
          `select quantity from public.stock_by_pickup_point where modification_id = $1`,
          [modificationId],
        )) as QtyRow[]
      )[0].quantity;
    const modStatus = async (): Promise<string | null> =>
      (
        (await queryRows(
          dbUrl,
          `select stock_status from public.product_modifications where id = $1`,
          [modificationId],
        )) as StatusRow[]
      )[0].stock_status;

    // `productId` тут ЗНАЧЕННЯ не має — items нижче перевизначає позицію на
    // цільову модифікацію (`baseInput` лишає інші поля контакту/доставки).
    const input: NewOrderInput = {
      ...baseInput(ids[FALLBACK_SLUG], 2, methodId, pointId),
      items: [
        {
          productId: null,
          modificationId,
          name: 'Модифікація',
          price: 100,
          quantity: 2,
          basePrice: null,
          discountData: null,
        },
      ],
    };
    const token = crypto.randomUUID();
    const order = await withOrderTokenDb(token, (db, operator) =>
      createOrder(db, null, token, input, operator),
    );

    expect(await modQuantity()).toBe(0);
    expect(await modStatus()).toBe('out_of_stock');

    await withOrderTokenDb(
      order.accessToken as string,
      async (db, operator) => {
        await operator((odb) => releaseOrderStock(odb, order.id));
      },
    );
    expect(await modQuantity()).toBe(2);
    expect(await modStatus()).toBe('in_stock');
  });

  it('🔴 I3: подвійне скасування (гвард lockOrderStatus) повертає залишок РІВНО один раз', async () => {
    const [{ id: pointId }] = (await queryRows(
      dbUrl,
      `insert into public.pickup_points (id, method_id, name, address, city, is_active, sort_order)
       values (gen_random_uuid(), $1, 'Тестова точка I3', 'вул. І3, 1', 'Київ', true, 22)
       returning id`,
      [methodId],
    )) as IdRow[];
    const productId = crypto.randomUUID();
    await queryRows(
      dbUrl,
      `insert into public.products (id, slug, name) values ($1, 'test-i3-double-cancel', 'Тест I3')`,
      [productId],
    );
    await queryRows(
      dbUrl,
      `insert into public.stock_by_pickup_point (id, pickup_point_id, product_id, modification_id, quantity)
       values (gen_random_uuid(), $1, $2, null, 5)`,
      [pointId, productId],
    );

    const order = await place(productId, 3, pointId);
    expect(await quantities(productId)).toEqual([2]);

    const [{ id: cancelledId }] = (await queryRows(
      dbUrl,
      `select id from public.order_statuses where code = 'cancelled'`,
    )) as IdRow[];
    const [{ status_id: originalStatusId }] = (await queryRows(
      dbUrl,
      `select status_id from public.orders where id = $1`,
      [order.id],
    )) as { status_id: string }[];

    // Дві паралельні транзакції, кожна відтворює РІВНО те, що робить
    // `cancelMyOrder` усередині ескалації: блокування рядка замовлення →
    // гвард статусу → повернення залишку → зміна статусу. Без
    // `lockOrderStatus` обидві прочитали б старий `status_id` під READ
    // COMMITTED і повернули б залишок ДВІЧІ.
    const cancelOnce = (): Promise<boolean> =>
      withOrderTokenDb(order.accessToken as string, (_db, operator) =>
        operator(async (odb) => {
          const locked = await lockOrderStatus(odb, order.id);
          if (!locked || locked.statusId !== originalStatusId) return false;
          await releaseOrderStock(odb, order.id);
          await setOrderStatus(odb, order.id, cancelledId);
          return true;
        }),
      );

    const results = await Promise.all([cancelOnce(), cancelOnce()]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await quantities(productId)).toEqual([5]);
  });

  it('🔴 M1: захоплений operator, викликаний ПІСЛЯ завершення своєї транзакції, кидає гучну помилку', async () => {
    // Замикання над `pg.PoolClient` не робить «ескалацію з нізвідки»
    // неможливою — сама по собі це лише функція. Гарантія тримається
    // прапорцем `finished`, а не структурою: перевіряємо, що виклик ПІСЛЯ
    // коміту (і повернення зʼєднання в пул) падає гучно, а не тихо чіпляє
    // роль до зʼєднання, яке пул тим часом міг віддати іншому запиту.
    const token = crypto.randomUUID();
    let leaked: OperatorEscalation | undefined;
    await withOrderTokenDb(token, async (_db, operator) => {
      leaked = operator;
    });

    await expect(leaked!(async () => {})).rejects.toThrow(/already finished/);
  });

  it('🔴 M4: реальний NULL фліпається в out_of_stock на нулі (рішення L, write-side)', async () => {
    const [{ id: pointId }] = (await queryRows(
      dbUrl,
      `insert into public.pickup_points (id, method_id, name, address, city, is_active, sort_order)
       values (gen_random_uuid(), $1, 'Тестова точка M4', 'вул. М4, 1', 'Київ', true, 23)
       returning id`,
      [methodId],
    )) as IdRow[];
    await queryRows(
      dbUrl,
      `insert into public.stock_by_pickup_point (id, pickup_point_id, product_id, modification_id, quantity)
       values (gen_random_uuid(), $1, $2, null, 2)`,
      [pointId, ids[NULL_STATUS_SLUG]],
    );

    // Перед замовленням статус — САМЕ NULL (той самий рядок, що й у read-side
    // кейсі вище), не рядок 'in_stock': гвард `or(isNull(col), eq(col,
    // 'in_stock'))` мусить спрацювати саме на NULL-гілці, інакше товар із
    // DEFAULT-статусом ніколи не переходив би в `out_of_stock`.
    expect(await statusOf(ids[NULL_STATUS_SLUG])).toBeNull();

    await place(ids[NULL_STATUS_SLUG], 2, pointId);
    expect(await quantities(ids[NULL_STATUS_SLUG])).toEqual([0]);
    expect(await statusOf(ids[NULL_STATUS_SLUG])).toBe('out_of_stock');
  });

  it('🔴 без системної точки резолв падає в ПЕРШУ АКТИВНУ за (sort_order, id)', async () => {
    // Третя ланка правила Р2 — єдина, яку демо-сід сам не відтворює: у ньому
    // рівно одна точка, і вона системна. Прапорець знімається на час кейса,
    // лишаються три активні точки, і найменший sort_order у сідової (0 проти
    // 10 і 11) — тож списання мусить піти саме в неї, а не в тестову.
    await queryRows(dbUrl, `update public.pickup_points set is_system = false`);
    try {
      await place(ids[FALLBACK_SLUG], 1);
      expect(await quantities(ids[FALLBACK_SLUG])).toEqual([1, 2]);
    } finally {
      await queryRows(
        dbUrl,
        `update public.pickup_points set is_system = true where name = 'Склад у Києві'`,
      );
    }
  });
});
