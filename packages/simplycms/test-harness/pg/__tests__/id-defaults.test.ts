import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { readdirSync } from 'node:fs';
import { resolveHarness } from '../up.mjs';
import {
  applySqlFiles,
  createTempDatabase,
  dropTempDatabase,
  queryRows,
  randomDbName,
  withDbName,
} from '../apply.mjs';

const CANON_DIR = join(import.meta.dirname, '../../../migrations');
const canonFiles = (): string[] =>
  readdirSync(CANON_DIR)
    .filter((n) => n.endsWith('.sql'))
    .sort()
    .map((n) => join(CANON_DIR, n));

/**
 * Категорія B — DEFAULT лишається КОНСТРУКТИВНО:
 *  • таблиці Better Auth: `generateId:'uuid'` + `supportsUUIDs` драйвера
 *    означає, що BA не кладе id в INSERT узагалі (`auth/instance.ts:78-87`);
 *  • `orders`: створює сервер із атомарним `order_number`.
 *
 * 🔴 «Категорія» тут і в `explicit-ids.test.ts` означає РІЗНІ речі, і плутати
 * їх не можна:
 *  • тут — площина СХЕМИ: «чи колонка `id` має DEFAULT у БД»;
 *  • там — площина КОДУ: «чи шлях вставки ПЕРЕДАЄ `id`».
 * Тому `orders` свідомо стоїть в обох гейтах по різні боки: сервер шле ключ
 * явно (там вона під вимогою), а DEFAULT у БД лишається страхувальною сіткою
 * (тут вона у виїмці). Склад Категорії B на рівні DDL — контракт етапу
 * (рішення К3-6), а не дефект реалізації: змінювати його «щоб збіглося»
 * означало б чіпати DDL, обидва гейти, план і спеку разом.
 */
const CATEGORY_B = new Set([
  'users',
  'sessions',
  'accounts',
  'verifications',
  'orders',
]);

/**
 * 🔴 `has_default` — це ФАКТ наявності DEFAULT (`d.oid is not null`), а не
 * збіг із `gen_random_uuid`. Знахідка аудиту: перевірка через ILIKE
 * пропустила б `uuid_generate_v4()` чи літерал, тобто гейт мовчав би саме
 * там, де мав спрацювати. Вираз лишаємо окремою колонкою — для діагностики.
 */
const ID_DEFAULTS_SQL = `
  select c.relname                                as table_name,
         (d.oid is not null)                      as has_default,
         coalesce(pg_get_expr(d.adbin, d.adrelid), '') as default_expr
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
   where n.nspname = 'public' and c.relkind = 'r'
     and a.attname = 'id' and a.attnum > 0 and not a.attisdropped
`;

describe('Е0: DEFAULT на id лише в Категорії B', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_id_defaults');
  let dbUrl: string;

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applySqlFiles(dbUrl, canonFiles());
  }, 120_000);

  afterAll(async () => {
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  it('жодна таблиця Категорії A не має DEFAULT на id', async () => {
    const rows = await queryRows(dbUrl, ID_DEFAULTS_SQL);
    expect(rows.length).toBeGreaterThan(0);
    const offenders = rows
      .filter((r) => r.has_default && !CATEGORY_B.has(r.table_name))
      .map((r) => `${r.table_name} (${r.default_expr})`)
      .sort();
    expect(
      offenders,
      `DEFAULT на id у Категорії A: ${offenders.join(', ')}`,
    ).toEqual([]);
  });

  it('Категорія B DEFAULT зберігає — інакше ляже auth і створення замовлень', async () => {
    const rows = await queryRows(dbUrl, ID_DEFAULTS_SQL);
    const withDefault = new Set(
      rows.filter((r) => r.has_default).map((r) => r.table_name),
    );
    for (const table of CATEGORY_B) {
      expect(
        withDefault.has(table),
        `${table} втратила DEFAULT — Категорія B`,
      ).toBe(true);
    }
  });
});
