// Воронка: кошик → placeOrderFor → рядок в orders; серверна ціна й знижка;
// доменні відмови (К2-Е0, Е0-4). Ціни й доставку рахує СЕРВЕР — у вхідних
// даних їх немає. База — покупний демо-сід (Task 7): метод `pickup`, точка
// «Склад у Києві», дефолтна зона, безкоштовний тариф; вимкнений метод — із
// HIDDEN_SHIPPING_FIXTURES (лише негативна частина: активну доставку дає сід,
// повний набір додав би другий активний тариф на ту саму пару метод+зона);
// решта негативних рядків — тест-локальні.
//
// 🔴 Рев'ю (Opus) до цього файлу додало кейси, яких перша версія не мала:
// I1 — курʼєр із МІСТОМ фактично рахує ненульову доставку (єдиний асерт
// раніше був `shipping_cost = '0.00'`, невідрізненний від дефолту/бага);
// M7 — НЕ-pickup метод БЕЗ міста відмовляється (`shipping_unavailable`), а
// не мовчки їде на дефолтну зону; M2 — порожній кошик відмовляється як
// `not_purchasable` ДО транзакції; M3 — відсутність рядка в `orders`
// перевірена на КОЖНІЙ відмові (ре-рев'ю: кейс `out_of_stock` спершу
// лишався без цього асерту — виправлено); M4 — три гілки ідентичності
// `priceCheckoutItems` (неактивний товар, чужа модифікація, товар без ціни
// для типу) мають по власному кейсу.
//
// Розділ M (серверна квота, К2-Е0): `quoteCheckoutFor` ділить `prepareCheckout`
// із `placeOrderFor`, тож три кейси нижче (M-10a/b/c) доводять «показане =
// записане» — курʼєр із тарифом, знижка за кількістю (квота НЕ дорівнює
// подвоєній ціні картки з quantity:1/cartTotal:0) і три відмови, ОДНАКОВІ
// для квоти й оформлення на тих самих входах.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDbPool } from 'simplycms/db';
import type { PlaceOrderInput, PlaceOrderRejection } from 'simplycms/contracts';
import { placeOrderFor, quoteCheckoutFor } from 'simplycms/storefront/loaders';
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
import {
  HIDDEN_METHOD_CODE,
  HIDDEN_SHIPPING_FIXTURES,
} from './fixtures/shipping';
import { percentDiscountStatements } from './fixtures/discounts';

const MIGRATIONS_DIR = join(import.meta.dirname, '../../../migrations');
const PANEL_SLUG = 'sonyachna-panel-450w-mono';
const OUT_OF_STOCK_SLUG = 'sonyachna-panel-550w-mono';
/** Активний товар БЕЗ модифікацій, який деактивуємо (M4) — не чіпає інші кейси. */
const INACTIVE_SLUG = 'sonyachna-panel-600w-bifacial';
/** Товар З модифікаціями: продукт-рівневої ціни немає, лише per-мод (M4). */
const NO_PRICE_SLUG = 'invertor-merezhevyi-5kw';
/**
 * Товар БЕЗ обліку залишку (сід веде облік лише для двох панелей — див.
 * коментар у `demo-seed.sql`): M-10 бере саме його, щоб квота й оформлення
 * можна було ганяти повторно, не рахуючи наперед, скільки лишилось на складі.
 */
const UNTRACKED_SLUG = 'invertor-gibrydnyi-8kw';
interface IdRow {
  id: string;
}

const input = (overrides: Partial<PlaceOrderInput>): PlaceOrderInput => ({
  firstName: 'Тест',
  lastName: 'Покупець',
  email: 'buyer@example.test',
  phone: '+380000000000',
  shippingMethodId: '',
  deliveryCity: null,
  deliveryAddress: null,
  pickupPointId: null,
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
  items: [],
  ...overrides,
});

describe('placeOrderFor: воронка й доменні відмови', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_checkout');
  let dbUrl = '';
  let pickup = '';
  let hidden = '';
  let courier = '';
  let norate = '';
  let point = '';
  let panel = '';
  let outOfStock = '';
  let inactiveProduct = '';
  let noPriceProduct = '';
  let foreignMod = '';
  let untracked = '';

  const one = async (sql: string, params: unknown[] = []): Promise<string> =>
    ((await queryRows(dbUrl, sql, params)) as IdRow[])[0].id;
  const ordersCount = async (): Promise<number> =>
    (
      (await queryRows(
        dbUrl,
        `select count(*)::int as c from public.orders`,
      )) as { c: number }[]
    )[0].c;

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
    // Негативна частина фікстури поверх сіду: вимкнений метод, зона, тариф, закрита точка.
    for (const statement of HIDDEN_SHIPPING_FIXTURES)
      await queryRows(dbUrl, statement);
    // Тест-локальні негативні методи: курʼєр із тарифом на дефолтній зоні
    // (точка чужого методу; і, з рев'ю, справжня платна доставка) і активний
    // метод без жодного тарифу.
    await queryRows(
      dbUrl,
      `insert into public.shipping_methods (id, code, name, is_active)
      values (gen_random_uuid(), 'courier', 'Курʼєр', true), (gen_random_uuid(), 'norate', 'Без тарифу', true)`,
    );
    await queryRows(
      dbUrl,
      `insert into public.shipping_rates (id, method_id, zone_id, name, calculation_type, base_cost, is_active, sort_order)
      select gen_random_uuid(), m.id, z.id, 'Тариф курʼєра', 'flat', 100, true, 0
        from public.shipping_methods m, public.shipping_zones z
       where m.code = 'courier' and z.is_default = true`,
    );
    pickup = await one(
      `select id from public.shipping_methods where code = 'pickup'`,
    );
    hidden = await one(
      `select id from public.shipping_methods where code = $1`,
      [HIDDEN_METHOD_CODE],
    );
    courier = await one(
      `select id from public.shipping_methods where code = 'courier'`,
    );
    norate = await one(
      `select id from public.shipping_methods where code = 'norate'`,
    );
    point = await one(
      `select id from public.pickup_points where name = 'Склад у Києві'`,
    );
    panel = await one(`select id from public.products where slug = $1`, [
      PANEL_SLUG,
    ]);
    outOfStock = await one(`select id from public.products where slug = $1`, [
      OUT_OF_STOCK_SLUG,
    ]);
    await queryRows(
      dbUrl,
      `update public.products set stock_status = 'out_of_stock' where id = $1`,
      [outOfStock],
    );
    // M4: товар, який деактивуємо (не чіпаючи is_active решти сіду), і
    // товар, у якого ціна є ЛИШЕ на модифікаціях (продукт-рівневого рядка
    // `product_prices` немає взагалі) — обидва вже в сіді, лише читаємо id.
    inactiveProduct = await one(
      `select id from public.products where slug = $1`,
      [INACTIVE_SLUG],
    );
    noPriceProduct = await one(
      `select id from public.products where slug = $1`,
      [NO_PRICE_SLUG],
    );
    foreignMod = await one(
      `select id from public.product_modifications where product_id = $1 and slug = 'odnofazny'`,
      [noPriceProduct],
    );
    await queryRows(
      dbUrl,
      `update public.products set is_active = false where id = $1`,
      [inactiveProduct],
    );
    untracked = await one(`select id from public.products where slug = $1`, [
      UNTRACKED_SLUG,
    ]);
    process.env.DATABASE_URL = withUser(dbUrl, 'app_runtime');
  }, 120_000);

  afterAll(async () => {
    await closeDbPool();
    await dropTempDatabase(harness.url, dbName);
    await harness.teardown();
  });

  it('гість: замовлення з серверною ціною позиції та доставкою', async () => {
    const result = await placeOrderFor(
      input({
        shippingMethodId: pickup,
        pickupPointId: point,
        items: [{ productId: panel, modificationId: null, quantity: 2 }],
      }),
      null,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [row] = (await queryRows(
      dbUrl,
      `select o.subtotal, o.shipping_cost, o.total, i.price, i.name
         from public.orders o join public.order_items i on i.order_id = o.id where o.id = $1`,
      [result.order.id],
    )) as {
      subtotal: string;
      shipping_cost: string;
      total: string;
      price: string;
      name: string;
    }[];
    // 4800 — ціна з product_prices демо-сіду, не з запиту (запит ціни не несе).
    expect(row.price).toBe('4800.00');
    expect(row.subtotal).toBe('9600.00');
    expect(row.shipping_cost).toBe('0.00');
    expect(row.total).toBe('9600.00');
    expect(row.name).toBe('Сонячна панель 450 Вт монокристалічна');
  });

  it('неактивний спосіб доставки — shipping_unavailable, рядка немає', async () => {
    const before = await ordersCount();
    const result = await placeOrderFor(
      input({
        shippingMethodId: hidden,
        items: [{ productId: panel, modificationId: null, quantity: 1 }],
      }),
      null,
    );
    expect(result).toEqual({ ok: false, reason: 'shipping_unavailable' });
    expect(await ordersCount()).toBe(before);
  });

  it('точка видачі чужого методу — pickup_point_invalid, рядка немає', async () => {
    const before = await ordersCount();
    const result = await placeOrderFor(
      input({
        shippingMethodId: courier,
        deliveryCity: 'Львів',
        pickupPointId: point,
        items: [{ productId: panel, modificationId: null, quantity: 1 }],
      }),
      null,
    );
    expect(result).toEqual({ ok: false, reason: 'pickup_point_invalid' });
    expect(await ordersCount()).toBe(before);
  });

  it('pickup-метод без точки видачі — pickup_point_invalid, рядка немає', async () => {
    const before = await ordersCount();
    const result = await placeOrderFor(
      input({
        shippingMethodId: pickup,
        pickupPointId: null,
        items: [{ productId: panel, modificationId: null, quantity: 1 }],
      }),
      null,
    );
    expect(result).toEqual({ ok: false, reason: 'pickup_point_invalid' });
    expect(await ordersCount()).toBe(before);
  });

  it('активний метод без застосовного тарифу — shipping_unavailable, а не безкоштовно', async () => {
    // 🔴 Місто ОБОВʼЯЗКОВО задане: інакше кейс ловить не «немає тарифу»
    // (те, що перевіряє назва), а новий гвард M7 «немає міста» — обидва
    // повертають той самий код, тож без міста тест мовчки перестав би
    // доводити те, що обіцяє.
    const before = await ordersCount();
    const result = await placeOrderFor(
      input({
        shippingMethodId: norate,
        deliveryCity: 'Дніпро',
        items: [{ productId: panel, modificationId: null, quantity: 1 }],
      }),
      null,
    );
    expect(result).toEqual({ ok: false, reason: 'shipping_unavailable' });
    expect(await ordersCount()).toBe(before);
  });

  it('НЕ-pickup метод без міста — shipping_unavailable (M7)', async () => {
    // Курʼєр БЕЗ міста інакше мовчки поїхав би на ДЕФОЛТНУ зону
    // (`findShippingZoneIn(zones, '')`) — тариф обирала б відсутність даних.
    const before = await ordersCount();
    const result = await placeOrderFor(
      input({
        shippingMethodId: courier,
        deliveryCity: null,
        items: [{ productId: panel, modificationId: null, quantity: 1 }],
      }),
      null,
    );
    expect(result).toEqual({ ok: false, reason: 'shipping_unavailable' });
    expect(await ordersCount()).toBe(before);
  });

  it('курʼєр із містом — сервер рахує НЕНУЛЬОВУ доставку (I1)', async () => {
    // 🔴 До рев'ю єдиний асерт `shipping_cost` у файлі був '0.00' — невідрізненний
    // від дефолту/бага. Курʼєр на дефолтній зоні (тариф `flat 100` з beforeAll)
    // доводить, що `rate.cost` справді летить у запис, а не літеральний нуль.
    const result = await placeOrderFor(
      input({
        shippingMethodId: courier,
        deliveryCity: 'Одеса',
        pickupPointId: null,
        items: [{ productId: panel, modificationId: null, quantity: 1 }],
      }),
      null,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [row] = (await queryRows(
      dbUrl,
      `select subtotal, shipping_cost, total from public.orders where id = $1`,
      [result.order.id],
    )) as { subtotal: string; shipping_cost: string; total: string }[];
    expect(row.subtotal).toBe('4800.00');
    expect(row.shipping_cost).toBe('100.00');
    expect(row.total).toBe('4900.00');
  });

  it('гість отримує знижку категорії за замовчуванням — як у getDiscountEnvironment', async () => {
    // Без дзеркала getDiscountEnvironment гість платив би 4800, а картка показує 4320.
    for (const statement of percentDiscountStatements({
      group: 'Роздрібна акція',
      name: 'Знижка на панель 450',
      percent: 10,
      categoryCode: 'retail',
      target: { type: 'product', slug: PANEL_SLUG },
    }))
      await queryRows(dbUrl, statement);
    const result = await placeOrderFor(
      input({
        shippingMethodId: pickup,
        pickupPointId: point,
        items: [{ productId: panel, modificationId: null, quantity: 1 }],
      }),
      null,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [row] = (await queryRows(
      dbUrl,
      `select price, base_price from public.order_items where order_id = $1`,
      [result.order.id],
    )) as { price: string; base_price: string | null }[];
    expect(row.price).toBe('4320.00');
    expect(row.base_price).toBe('4800.00');
  });

  it('позиція out_of_stock — not_purchasable', async () => {
    const before = await ordersCount();
    const result = await placeOrderFor(
      input({
        shippingMethodId: pickup,
        pickupPointId: point,
        items: [{ productId: outOfStock, modificationId: null, quantity: 1 }],
      }),
      null,
    );
    expect(result).toEqual({ ok: false, reason: 'not_purchasable' });
    expect(await ordersCount()).toBe(before);
  });

  it('неактивний товар у кошику — not_purchasable (M4)', async () => {
    const result = await placeOrderFor(
      input({
        shippingMethodId: pickup,
        pickupPointId: point,
        items: [
          { productId: inactiveProduct, modificationId: null, quantity: 1 },
        ],
      }),
      null,
    );
    expect(result).toEqual({ ok: false, reason: 'not_purchasable' });
  });

  it('модифікація належить іншому товару — not_purchasable (M4)', async () => {
    const result = await placeOrderFor(
      input({
        shippingMethodId: pickup,
        pickupPointId: point,
        // `foreignMod` — модифікація NO_PRICE_SLUG, а не `panel`.
        items: [{ productId: panel, modificationId: foreignMod, quantity: 1 }],
      }),
      null,
    );
    expect(result).toEqual({ ok: false, reason: 'not_purchasable' });
  });

  it('товар без ціни для типу (лише мод-рівневі рядки) — not_purchasable (M4)', async () => {
    const result = await placeOrderFor(
      input({
        shippingMethodId: pickup,
        pickupPointId: point,
        // Без modificationId — продукт-рівневого `product_prices` рядка немає.
        items: [
          { productId: noPriceProduct, modificationId: null, quantity: 1 },
        ],
      }),
      null,
    );
    expect(result).toEqual({ ok: false, reason: 'not_purchasable' });
  });

  it('порожній кошик — not_purchasable до транзакції (M2)', async () => {
    const before = await ordersCount();
    const result = await placeOrderFor(
      input({ shippingMethodId: pickup }),
      null,
    );
    expect(result).toEqual({ ok: false, reason: 'not_purchasable' });
    expect(await ordersCount()).toBe(before);
  });

  it('нестача залишку в транзакції — not_purchasable без рядка в orders', async () => {
    // Сідовий залишок 450w — 5; попередні успішні замовлення цього файлу
    // (тест 1, курʼєр I1, знижка) списали 4 — лишається 1. Запит на 10
    // проходить читання (статус in_stock), але падає у списанні → відкат.
    const before = await ordersCount();
    const result = await placeOrderFor(
      input({
        shippingMethodId: pickup,
        pickupPointId: point,
        items: [{ productId: panel, modificationId: null, quantity: 10 }],
      }),
      null,
    );
    expect(result).toEqual({ ok: false, reason: 'not_purchasable' });
    expect(await ordersCount()).toBe(before);
  });

  // Розділ M рішень архітектора: `quoteCheckoutFor` і `placeOrderFor` ділять
  // `prepareCheckout` — нижче це доводиться напряму, а не з коментаря.
  // `UNTRACKED_SLUG` — без обліку залишку, тож незалежний від решти файлу.

  it('квота = записане замовлення: курʼєр із тарифом (M-10a)', async () => {
    const request = input({
      shippingMethodId: courier,
      deliveryCity: 'Одеса',
      items: [{ productId: untracked, modificationId: null, quantity: 1 }],
    });
    const quoted = await quoteCheckoutFor(request, null);
    expect(quoted.ok).toBe(true);
    if (!quoted.ok) return;
    expect(quoted.quote.shippingCost).toBe(100);

    const placed = await placeOrderFor(request, null);
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    const [row] = (await queryRows(
      dbUrl,
      `select shipping_cost, total from public.orders where id = $1`,
      [placed.order.id],
    )) as { shipping_cost: string; total: string }[];
    expect(row.shipping_cost).toBe('100.00');
    expect(Number(row.total)).toBe(quoted.quote.total);
  });

  it('квота = записане замовлення при знижці за кількістю; НЕ дорівнює подвоєній ціні картки (M-10b)', async () => {
    // Умова `min_quantity >= 2`: картка товару рахує з quantity:1/cartTotal:0
    // (не бачить кошика) і цієї знижки НЕ дасть — розбіжність показ/запис,
    // яку розділ M і закриває.
    await queryRows(
      dbUrl,
      `insert into public.discount_groups (id, name, operator, is_active)
       values (gen_random_uuid(), 'Кількісна знижка', 'and', true)`,
    );
    await queryRows(
      dbUrl,
      `insert into public.discounts (id, name, group_id, discount_type, discount_value, is_active, price_type_id)
       select gen_random_uuid(), 'Від 2 шт — 20%', g.id, 'percent', 20, true, pt.id
         from public.discount_groups g cross join public.price_types pt
        where g.name = 'Кількісна знижка' and pt.code = 'retail'`,
    );
    await queryRows(
      dbUrl,
      `insert into public.discount_conditions (id, discount_id, condition_type, operator, value)
       select gen_random_uuid(), d.id, 'min_quantity', '>=', '2'::jsonb
         from public.discounts d where d.name = 'Від 2 шт — 20%'`,
    );
    await queryRows(
      dbUrl,
      `insert into public.discount_targets (id, discount_id, target_type, target_id)
       select gen_random_uuid(), d.id, 'product', p.id
         from public.discounts d cross join public.products p
        where d.name = 'Від 2 шт — 20%' and p.id = $1`,
      [untracked],
    );

    const request = input({
      shippingMethodId: pickup,
      pickupPointId: point,
      items: [{ productId: untracked, modificationId: null, quantity: 2 }],
    });
    const quoted = await quoteCheckoutFor(request, null);
    expect(quoted.ok).toBe(true);
    if (!quoted.ok) return;
    // 24500 базова ціна; 20% лише від qty>=2 → 19600/шт = 39200 разом,
    // а не 2×24500 = 49000, яке дала б картка (quantity:1, cartTotal:0).
    expect(quoted.quote.subtotal).toBe(39200);
    expect(quoted.quote.subtotal).not.toBe(2 * 24500);

    const placed = await placeOrderFor(request, null);
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    const [row] = (await queryRows(
      dbUrl,
      `select subtotal from public.orders where id = $1`,
      [placed.order.id],
    )) as { subtotal: string }[];
    expect(row.subtotal).toBe('39200.00');
  });

  it('квота повертає ті самі три відмови, що й оформлення (M-10c)', async () => {
    const cases: {
      reason: PlaceOrderRejection;
      overrides: Partial<PlaceOrderInput>;
    }[] = [
      {
        reason: 'shipping_unavailable',
        overrides: {
          shippingMethodId: hidden,
          items: [{ productId: panel, modificationId: null, quantity: 1 }],
        },
      },
      {
        reason: 'pickup_point_invalid',
        overrides: {
          shippingMethodId: pickup,
          pickupPointId: null,
          items: [{ productId: panel, modificationId: null, quantity: 1 }],
        },
      },
      {
        reason: 'not_purchasable',
        overrides: {
          shippingMethodId: pickup,
          pickupPointId: point,
          items: [{ productId: outOfStock, modificationId: null, quantity: 1 }],
        },
      },
    ];

    for (const { reason, overrides } of cases) {
      const request = input(overrides);
      expect(await quoteCheckoutFor(request, null)).toEqual({
        ok: false,
        reason,
      });
      expect(await placeOrderFor(request, null)).toEqual({
        ok: false,
        reason,
      });
    }
  });
});
