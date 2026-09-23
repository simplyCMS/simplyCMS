// Е3, Task 3: ресурси каталогу on-demand проти живої БД. Шапка — ДОСЛІВНО
// патерн admin-order-statuses.test.ts (createTempDatabase → канон →
// app_runtime → afterAll із closeDbPool() ПЕРШИМ).
//
// 🔴 serverFn тут НЕ викликаються (getRequest() без ALS-контексту падає) —
// requireGrant мокається модульно, а ресурси беруться напряму зі службового
// server-only субшляху `simplycms/admin-server/impl` (легальний у тестах
// харнеса; клієнтський код його не імпортує НІКОЛИ — Gate C стереже це
// payload-маркером). setResponseStatus теж мокається — поза HTTP-запитом
// Start-контексту немає, і toAdminConflict інакше кинув би сам.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { closeDbPool } from 'simplycms/db';
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

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));

// 🔴 Мок ОГОЛОШУЄТЬСЯ до імпортів операцій — vitest hoist-ить `vi.mock` над
// усіма імпортами модуля, тож порядок рядків тут не грає ролі, але порядок
// СЕКЦІЙ («мок» → «операції») лишається явним для читача.
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: null, roles: ['admin'] },
    scope: 'any',
  })),
}));

import {
  productsOps,
  productModificationsOps,
  productPricesOps,
  sectionsReadOps,
  AdminConflictError,
} from 'simplycms/admin-server/impl';
// 🔴 requireGrant тут — вже ЗМОКАНА функція (vi.fn з блоку вище); resolveGrant
// і AuthzError — реальні, бо фабрика мока робить `...(await orig())` і
// перекриває лише requireGrant. Потрібні для Е3-6 нижче.
import { requireGrant, resolveGrant, AuthzError } from 'simplycms/auth';

const MIGRATIONS = join(import.meta.dirname, '../../../migrations');

/** Канон у порядку імен — той самий список, що й у baseline.test.ts. */
const canonFiles = (): string[] =>
  readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => join(MIGRATIONS, name));

const SECTION = '0e300000-0000-4000-8000-000000000001';
const at = new Date('2026-09-01T00:00:00Z');

const product = (i: number) => ({
  id: crypto.randomUUID(),
  slug: `e3-product-${i}`,
  name: `Товар ${i}`,
  sectionId: SECTION,
});

describe('products: ресурс on-demand проти живої БД (Е3, Task 3)', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_admin_catalog');
  let dbUrl = '';

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applySqlFiles(dbUrl, canonFiles());
    process.env.DATABASE_URL = withUser(dbUrl, 'app_runtime');

    // Фікстура розділу — ПРИВІЛЕЙОВАНИМ підключенням (dbUrl), не операцією:
    // CRUD розділів — Е4, а тут потрібен лише рядок, на який посилається
    // товар.
    await queryRows(
      dbUrl,
      `insert into public.sections (id, slug, name) values ($1, 'e3-section', 'Розділ Е3')`,
      [SECTION],
    );
  }, 120_000);

  afterAll(async () => {
    await closeDbPool();
    delete process.env.DATABASE_URL;
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  it('insert з клієнтським id і list з фільтром sectionId', async () => {
    const rows = await productsOps.insert({ data: [product(1), product(2)] });
    expect(rows.map((r) => r.slug).sort()).toEqual([
      'e3-product-1',
      'e3-product-2',
    ]);
    const listed = await productsOps.list({
      data: {
        subset: {
          filters: [{ field: ['sectionId'], operator: 'eq', value: SECTION }],
        },
      },
    });
    expect(listed.length).toBeGreaterThanOrEqual(2);
    expect(listed.every((r) => r.sectionId === SECTION)).toBe(true);
  });

  // Регресійний смок, НЕ доказ інваріанта (доказ — юніт Task 1 Step 5,
  // resource.test.ts «id asc — ОСТАННІЙ ключ сортування»): без тай-брейкера
  // Postgres на малій таблиці може дати той самий порядок.
  it('Review Focus 3: однакові created_at — три сторінки по 3 дають 7 різних id', async () => {
    const batch = Array.from({ length: 7 }, (_, i) => product(100 + i));
    await productsOps.insert({ data: batch });
    await queryRows(
      dbUrl,
      `update public.products set created_at = $1 where slug like 'e3-product-1__'`,
      [at],
    );
    const page = (offset: number) =>
      productsOps.list({
        data: {
          subset: {
            filters: [{ field: ['sectionId'], operator: 'eq', value: SECTION }],
            sorts: [{ field: ['createdAt'], direction: 'desc' }],
            limit: 3,
            ...(offset > 0 && { offset }),
          },
        },
      });
    const seen = (await Promise.all([page(0), page(3), page(6), page(9)]))
      .flat()
      .filter((r) => r.slug.startsWith('e3-product-1') && r.slug.length === 14)
      .map((r) => r.id);
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen).toHaveLength(7);
  });

  it('touch: update ставить updated_at свіжішим за created_at', async () => {
    const [p] = await productsOps.insert({ data: [product(3)] });
    await queryRows(
      dbUrl,
      `update public.products set updated_at = $1 where id = $2`,
      [at, p!.id],
    );
    const [u] = await productsOps.update({
      data: [{ id: p!.id, patch: { name: 'Нова назва' } }],
    });
    expect(u!.updatedAt.getTime()).toBeGreaterThan(at.getTime());
  });

  it('Review Focus 1: дубль slug → AdminConflictError unique з назвою обмеження', async () => {
    const err = await productsOps
      .insert({ data: [{ ...product(4), slug: 'e3-product-1' }] })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AdminConflictError);
    expect(err).toMatchObject({
      kind: 'unique',
      constraint: 'products_slug_key',
    });
  });

  it('Review Focus 2: товар у замовленні → AdminConflictError reference, рядок живий', async () => {
    const [p] = await productsOps.insert({ data: [product(5)] });
    const orderId = crypto.randomUUID();
    // 🔴 Відхилення від брифа (факт коду, не помилка плану): `orders` у
    // schema.ts не має колонки `status` (є nullable `status_id`, FK на
    // order_statuses) — insert зі `status` впав би 42703 (колонки немає).
    // NOT NULL без DEFAULT у orders — рівно 9 колонок нижче, status_id серед
    // них немає (nullable), тож просто не передаємо його.
    await queryRows(
      dbUrl,
      `insert into public.orders (id, order_number, subtotal, total, first_name, last_name, email, phone, payment_method)
       values ($1, 'E3-1', 1, 1, 'Т', 'П', 't@example.test', '+380000000000', 'cash')`,
      [orderId],
    );
    await queryRows(
      dbUrl,
      `insert into public.order_items (id, order_id, product_id, name, price, quantity, total)
       values ($1, $2, $3, 'Товар 5', 1, 1, 1)`,
      [crypto.randomUUID(), orderId, p!.id],
    );
    const err = await productsOps
      .remove({ data: [{ id: p!.id }] })
      .catch((e: unknown) => e);
    expect(err).toMatchObject({
      name: 'AdminConflictError',
      kind: 'reference',
    });
    expect(
      await queryRows(dbUrl, `select 1 from public.products where id = $1`, [
        p!.id,
      ]),
    ).toHaveLength(1);
  });

  it('Review Focus 1 для модифікації: дубль slug у товарі → конфлікт на product_modifications_product_slug_unique', async () => {
    const [p] = await productsOps.insert({ data: [product(7)] });
    const mod = (id: string) => ({
      id,
      productId: p!.id,
      slug: 'same',
      name: 'M',
    });
    await productModificationsOps.insert({ data: [mod(crypto.randomUUID())] });
    const err = await productModificationsOps
      .insert({ data: [mod(crypto.randomUUID())] })
      .catch((e: unknown) => e);
    // 🔴 Імʼя НЕ за конвенцією *_slug_key — задане руками (schema.ts:445).
    expect(err).toMatchObject({
      kind: 'unique',
      constraint: 'product_modifications_product_slug_unique',
    });
  });

  it('фільтр по недозволеній колонці відбито (allowlist ресурсу)', async () => {
    await expect(
      productsOps.list({
        data: {
          subset: {
            filters: [{ field: ['description'], operator: 'eq', value: 'x' }],
          },
        },
      }),
    ).rejects.toThrow(/недозволеній колонці/);
  });

  // 🔴 Відхилення від брифа (факт коду): `ops.insert()` САМ Zod НЕ ганяє —
  // strip readonly-полів робить `inputValidator` на межі serverFn (Task 5),
  // а не сама операція. Виклик `.insert()` напряму (як буквально в плані) з
  // `isDefault: true` у payload проносить його аж до `db.insert().values()`
  // без жодного strip — і `is_default` реально стає `true` (перевірено:
  // тест зі старою формою РЕАЛЬНО червонів). Тут ЯВНО проганяємо
  // `insertSchema.parse()` перед `.insert()` — це і є те, що робить
  // inputValidator у реальному запиті; так тест доводить ПОВНИЙ шлях, а не
  // хибне припущення про валідацію всередині операції.
  it('модифікація: insert без isDefault у writable — прапорець лишається false (шлях через inputValidator)', async () => {
    const [p] = await productsOps.insert({ data: [product(6)] });
    const parsed = productModificationsOps.insertSchema.parse([
      {
        id: crypto.randomUUID(),
        productId: p!.id,
        slug: 'm1',
        name: 'M1',
        isDefault: true,
      },
    ]);
    const [m] = await productModificationsOps.insert({ data: parsed });
    expect(m!.isDefault).toBe(false);
  });

  it('читальний ресурс розділів бачить і неактивні (адмін-поверхня)', async () => {
    await queryRows(
      dbUrl,
      `insert into public.sections (id, slug, name, is_active) values ($1, 'e3-hidden', 'Прихований', false)`,
      [crypto.randomUUID()],
    );
    const rows = await sectionsReadOps.list({ data: {} });
    expect(rows.some((r) => r.slug === 'e3-hidden')).toBe(true);
  });

  // 🔴 Е3-6 (рішення архітектора): адмін-поверхня каталогу, включно з
  // ЧИТАННЯМ, мусить іти під `catalog.write` (тільки admin, `AUTHZ_MATRIX`),
  // а НЕ `catalog.read` (`{ user: 'any', admin: 'any' }` — ЛЮБИЙ автентифі-
  // кований покупець отримав би scope 'any' і бачив чернетки/неактивні
  // розділи). Блок-мок файла завжди дає адмінський grant, тож РІЗНИЦЮ між
  // операціями через нього не видно — тут requireGrant підмінено ОДИН раз
  // на РЕАЛЬНИЙ resolveGrant/AuthzError із СУБʼЄКТОМ-ПОКУПЦЕМ (роль 'user',
  // не 'admin'): якщо ресурс просить catalog.write — resolveGrant дає null
  // (у матриці 'catalog.write' немає ключа 'user') → AuthzError; якщо
  // мутація підмінить операцію на catalog.read — 'user' у матриці Є
  // ('any') → виклик пройшов би без кидка, і toThrow нижче почервонів би.
  it('Е3-6: sectionsReadOps вимагає catalog.write — покупець без ролі admin отримує відмову', async () => {
    vi.mocked(requireGrant).mockImplementationOnce(async (operation) => {
      const subject = { userId: 'u2', roles: ['user'] as const };
      const scope = resolveGrant(subject, operation);
      if (!scope) throw new AuthzError(operation);
      return { subject, scope };
    });
    await expect(sectionsReadOps.list({ data: {} })).rejects.toThrow(
      AuthzError,
    );
  });

  // 🔴 Е3-14 (аудит 2026-09-23): у брифі доказ isNull відсилався «до
  // харнесу Task 3», але самого кейсу не було — subset.test.ts (Task 1)
  // доводить лише форму SQL (unit, синтетична таблиця), не РЕАЛЬНУ вибірку
  // цін рівня товару проти живої БД. price_types сідиться каноном
  // (0003_seed.sql, код 'retail'), тож окремої фікстури типу ціни не треба.
  it('Е3-14: isNull на modification_id повертає рівно ціни рівня товару', async () => {
    const [p] = await productsOps.insert({ data: [product(8)] });
    const [m] = await productModificationsOps.insert({
      data: [
        {
          id: crypto.randomUUID(),
          productId: p!.id,
          slug: 'e3-mod-8',
          name: 'Модифікація 8',
        },
      ],
    });
    const [priceType] = (await queryRows(
      dbUrl,
      `select id from public.price_types where code = 'retail'`,
    )) as { id: string }[];
    const productLevelId = crypto.randomUUID();
    await queryRows(
      dbUrl,
      `insert into public.product_prices (id, price_type_id, product_id, modification_id, price)
       values ($1, $2, $3, null, '10.00')`,
      [productLevelId, priceType!.id, p!.id],
    );
    await queryRows(
      dbUrl,
      `insert into public.product_prices (id, price_type_id, product_id, modification_id, price)
       values ($1, $2, $3, $4, '12.00')`,
      [crypto.randomUUID(), priceType!.id, p!.id, m!.id],
    );
    const rows = await productPricesOps.list({
      data: {
        subset: {
          filters: [
            { field: ['productId'], operator: 'eq', value: p!.id },
            { field: ['modificationId'], operator: 'isNull', value: null },
          ],
        },
      },
    });
    expect(rows.map((r) => r.id)).toEqual([productLevelId]);
  });
});
