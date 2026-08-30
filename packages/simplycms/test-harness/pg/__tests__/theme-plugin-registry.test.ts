// Гейт реєстрів теми й плагіна проти живого Postgres (рішення B9).
//
// 🔴 Юніт тут не доводить нічого важливого: обидва bootstrap-и мокають
// серверну поверхню, а питання, яке насправді вирішує безпеку, — чи справді
// БД відмовляє не-адміну в записі й чи резолвиться активна тема тим самим
// шляхом, яким її бачить SSR. Обидві відповіді дає лише реальна база.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDbPool } from 'simplycms/db';
import { withStorefrontDb } from 'simplycms/storefront/loaders';
// 🔴 Відносні шляхи, а не субшляхи пакета: `registry-db` — внутрішній модуль
// під serverFn-обгортками, і робити його публічним входом заради тесту
// означало б розширити поверхню пакета рівно тим, що ховає serverFn.
import {
  insertMissingThemes,
  selectThemeNames,
} from '../../../src/themes/server/registry-db';
import {
  insertMissingPlugins,
  selectActivePlugins,
  selectPluginNames,
} from '../../../src/plugins/server/registry-db';
import { loadActiveTheme } from 'simplycms/storefront-routes/server/theme-record';
import { resolveHarness } from '../up.mjs';
import {
  applySqlFiles,
  createTempDatabase,
  dropTempDatabase,
  randomDbName,
  withDbName,
  withUser,
} from '../apply.mjs';

const CANON_DIR = join(import.meta.dirname, '../../../migrations');

const canonFiles = (): string[] =>
  readdirSync(CANON_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => join(CANON_DIR, name));

describe('реєстри теми й плагіна проти живого Postgres', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_registry');
  let dbUrl: string;

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applySqlFiles(dbUrl, canonFiles());
    // Як у проді: застосунок конектиться `app_runtime`, права дає лише
    // `SET LOCAL ROLE` всередині `withActor`.
    process.env.DATABASE_URL = withUser(dbUrl, 'app_runtime');
  }, 120_000);

  afterAll(async () => {
    await closeDbPool();
    delete process.env.DATABASE_URL;
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  it('активна тема резолвиться сервером — тим самим шляхом, що й SSR', async () => {
    const record = await loadActiveTheme();

    expect(record?.name).toBe('default');
    expect(record?.is_active).toBe(true);
    // Саме цей рядок лоадер каркаса віддає провайдеру теми; налаштування
    // мусять приїхати обʼєктом, а не рядком jsonb.
    expect(typeof record?.settings).toBe('object');
  });

  it('bootstrap теми: не-адміну запис відбито, адміну — дописано', async () => {
    const row = {
      name: 'aurora',
      display_name: 'Aurora',
      version: '1.0.0',
      description: null,
      author: null,
    };

    // -1 — відмова доступу; рядка в БД після неї бути не має.
    expect(await insertMissingThemes([row], false)).toBe(-1);
    expect(await selectThemeNames()).not.toContain('aurora');

    expect(await insertMissingThemes([row], true)).toBe(1);
    expect(await selectThemeNames()).toContain('aurora');

    // Повторний виклик — no-op: bootstrap не дублює рядків.
    expect(await insertMissingThemes([row], true)).toBe(0);

    // 🔴 Рубіж не в прапорці, а в грантах: роль вітрини не має INSERT на
    // `themes` навіть якщо гард обійти. Без цієї перевірки тест доводив би
    // лише власний `if`.
    // Drizzle загортає помилку драйвера, тож текст Postgres лежить у `cause`.
    const denied = await withStorefrontDb((db) =>
      db.execute(
        `insert into themes (id, name, display_name, version) values (gen_random_uuid(), 'sneaky', 'Sneaky', '1.0.0')`,
      ),
    ).then(
      () => null,
      (error: Error) =>
        (error.cause as Error | undefined)?.message ?? error.message,
    );
    expect(denied).toMatch(/permission denied/i);

    // Активність задає адмін, не встановлення пакета.
    const result = await withStorefrontDb((db) =>
      db.execute(`select is_active from themes where name = 'aurora'`),
    );
    expect((result.rows as { is_active: boolean }[])[0].is_active).toBe(false);
  });

  it('bootstrap плагіна: не-адміну відбито, адміну — дописано неактивним', async () => {
    const row = {
      name: 'faq',
      display_name: 'FAQ',
      version: '0.4.0',
      description: null,
      author: null,
      hooks: [{ name: 'product.detail.after' }],
    };

    expect(await insertMissingPlugins([row], false)).toBe(-1);
    expect(await selectPluginNames()).not.toContain('faq');

    expect(await insertMissingPlugins([row], true)).toBe(1);
    expect(await selectPluginNames()).toContain('faq');
    // Дописаний рядок неактивний — інакше встановлення пакета вмикало б
    // плагін повз рішення адміна.
    expect(
      (await selectActivePlugins()).map((item) => item.name),
    ).not.toContain('faq');
  });
});
