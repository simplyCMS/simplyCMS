// К3-14: часткові unique-індекси `is_default` — поведінковий доказ, що
// інваріант «не більше одного дефолту» тримає БД, а не два нетранзакційні
// запити з браузера (unset-усіх → insert нового), які й досі лишаються
// єдиним записувачем на v2-стеку (легасі-клієнт БД без HTTP-посередника).
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveHarness } from '../up.mjs';
import {
  applyCanon,
  applySqlFiles,
  createTempDatabase,
  dropTempDatabase,
  LANGUAGES_LOCK_SQL,
  queryInTransaction,
  queryRows,
  randomDbName,
  withDbName,
} from '../apply.mjs';
import { modificationGraphSql } from './fixtures/product-graph';

const MIGRATIONS = join(import.meta.dirname, '../../../migrations');
// 🔴 Локальна константа — `aggregate-deps.test.ts` (Task 1) ще не існує на
// момент цього завдання; шлях той самий, що використає той файл пізніше.
const DEMO_SEED = join(MIGRATIONS, 'demo/demo-seed.sql');

/**
 * 🔴 Параметризовано на ВСІ 7 індексів (рев'ю р3: два кейси доводили 2 з
 * 7, а `drizzle-kit generate` пропущений синхронно в усіх джерелах індекс
 * не помітить). NOT NULL-колонки — з 0001_init.sql кожної таблиці.
 *
 * 🔴 GLOBAL-кейс НЕ покладається на сід: спершу reset (`is_default=false`
 * усім), потім insert #1 (мусить пройти — доводить, що індекс не заважає
 * першому), потім insert #2 → 23505.
 * Коди — унікальні відносно сіду (UNIQUE code у languages/user_categories).
 *
 * 🔴 `shipping_zones` і `languages` у GLOBAL немає: сід тримає єдину основну
 * зону (і мову), а reset — зняти дефолт — відхилили б відкладений тригер зони
 * і `languages_guard` (`is_default` мови незмінний) — для обох окремі кейси
 * нижче, без reset.
 */
const U1 = 'a0000000-0000-4000-8000-000000000001';
const U2 = 'a0000000-0000-4000-8000-000000000002';
const P1 = '10000002-0000-4000-8000-000000000001'; // товар демо-сіду (без модифікацій)
const P2 = '10000002-0000-4000-8000-000000000004'; // інвертор (має модифікації)

/** [таблиця, INSERT #1 (проходить), INSERT #2 (23505)]. */
const GLOBAL: Array<[table: string, first: string, second: string]> = [
  [
    'order_statuses',
    `insert into public.order_statuses (id, name, code, is_default) values (gen_random_uuid(), 'Дефолт 1', 'dflt-1', true)`,
    `insert into public.order_statuses (id, name, code, is_default) values (gen_random_uuid(), 'Дефолт 2', 'dflt-2', true)`,
  ],
  [
    'user_categories',
    `insert into public.user_categories (id, name, code, is_default) values (gen_random_uuid(), 'Дефолт 1', 'dflt-1', true)`,
    `insert into public.user_categories (id, name, code, is_default) values (gen_random_uuid(), 'Дефолт 2', 'dflt-2', true)`,
  ],
];

/** [таблиця, INSERT для батька A, INSERT для батька B, ДРУГИЙ INSERT для батька A]. */
const SCOPED: Array<[table: string, a: string, b: string, aAgain: string]> = [
  [
    'user_recipients',
    `insert into public.user_recipients (id, user_id, first_name, last_name, phone, city, address, is_default) values (gen_random_uuid(), '${U1}', 'А', 'А', '+380000000001', 'Київ', 'вул. Тестова, 1', true)`,
    `insert into public.user_recipients (id, user_id, first_name, last_name, phone, city, address, is_default) values (gen_random_uuid(), '${U2}', 'Б', 'Б', '+380000000002', 'Львів', 'вул. Тестова, 2', true)`,
    `insert into public.user_recipients (id, user_id, first_name, last_name, phone, city, address, is_default) values (gen_random_uuid(), '${U1}', 'В', 'В', '+380000000003', 'Київ', 'вул. Тестова, 3', true)`,
  ],
  [
    'user_addresses',
    `insert into public.user_addresses (id, user_id, name, city, address, is_default) values (gen_random_uuid(), '${U1}', 'Дім', 'Київ', 'вул. Тестова, 1', true)`,
    `insert into public.user_addresses (id, user_id, name, city, address, is_default) values (gen_random_uuid(), '${U2}', 'Дім', 'Львів', 'вул. Тестова, 2', true)`,
    `insert into public.user_addresses (id, user_id, name, city, address, is_default) values (gen_random_uuid(), '${U1}', 'Офіс', 'Київ', 'вул. Тестова, 3', true)`,
  ],
  [
    'product_modifications',
    modificationGraphSql(P1, {
      id: randomUUID(),
      slug: 'dflt-a',
      name: 'A',
      isDefault: true,
    }),
    // 🔴 P2 у демо-сіді ВЖЕ має дефолтну модифікацію — тут вставка з
    // is_default=false лише доводить, що індекс не заважає не-дефолтам.
    modificationGraphSql(P2, {
      id: randomUUID(),
      slug: 'extra-b',
      name: 'B',
      isDefault: false,
    }),
    modificationGraphSql(P1, {
      id: randomUUID(),
      slug: 'dflt-a2',
      name: 'A2',
      isDefault: true,
    }),
  ],
];

describe('К3-14: інваріант is_default тримає БД (усі 7 індексів)', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_single_default');
  let dbUrl: string;

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applyCanon(dbUrl);
    // Демо-сід — для товарів (P1/P2); користувачі — власна фікстура.
    await applySqlFiles(dbUrl, [DEMO_SEED]);
    await queryRows(
      dbUrl,
      `insert into public.users (id, name, email, email_verified)
      values ('${U1}', 'А', 'a@t.test', true), ('${U2}', 'Б', 'b@t.test', true)`,
    );
  }, 120_000);

  afterAll(async () => {
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  it.each(GLOBAL)(
    '%s: перший дефолт проходить, другий — 23505',
    async (table, first, second) => {
      await queryRows(
        dbUrl,
        `update public.${table} set is_default = false where is_default`,
      );
      await queryRows(dbUrl, first); // індекс не заважає єдиному дефолту
      await expect(queryRows(dbUrl, second)).rejects.toMatchObject({
        code: '23505',
      });
    },
  );

  it('shipping_zones: сід уже тримає основну зону — друга основна → 23505', async () => {
    await expect(
      queryRows(
        dbUrl,
        `insert into public.shipping_zones (id, name, is_default) values (gen_random_uuid(), 'Дефолт 2', true)`,
      ),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('languages: сід уже тримає основну мову — друга основна → 23505', async () => {
    // `published` обовʼязковий: основна не в `published` упала б раніше на
    // CHECK `languages_default_published` (23514), а не на індексі.
    await expect(
      queryInTransaction(dbUrl, [
        LANGUAGES_LOCK_SQL,
        `insert into public.languages (id, code, name, status, is_default) values (gen_random_uuid(), 'pl', 'Polski', 'published', true)`,
      ]),
    ).rejects.toMatchObject({
      code: '23505',
      constraint: 'idx_languages_single_default',
    });
  });

  it.each(SCOPED)(
    '%s: різні батьки — можна, той самий — 23505',
    async (_table, a, b, aAgain) => {
      await queryRows(dbUrl, a);
      await queryRows(dbUrl, b);
      await expect(queryRows(dbUrl, aAgain)).rejects.toMatchObject({
        code: '23505',
      });
    },
  );
});
