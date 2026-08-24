// Гейт межі даних плагіна проти живого Postgres (рішення B9 спеки v2).
//
// 🔴 Питання, на яке відповідає лише БД: чи справді плагін дістає СВОЮ
// таблицю і не дістає таблицю ядра тим самим портом. Юніт гарда
// (`plugin-sdk/__tests__/table-guard.test.ts`) доводить рішення про імʼя;
// що те рішення справді стоїть між плагіном і базою — доводиться тут.
//
// 🔴 Таблиці `plg_*` у канон-схемі немає за побудовою: їх докочують міграції
// плагінів. Тому тест створює свою руками — рівно так, як це зробила б
// міграція плагіна (таблиця + гранти ролям, модель B5″).
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDbPool } from 'simplycms/db';
import {
  deletePluginRow,
  insertPluginRow,
  selectPluginRows,
  updatePluginRow,
} from '../../../src/plugin-sdk/server/table-db';
import {
  selectPluginConfig,
  savePluginConfig,
} from '../../../src/plugin-sdk/server/config-db';
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

const CANON_DIR = join(import.meta.dirname, '../../../migrations');
const PLUGIN = 'testkit';
const TABLE = 'plg_testkit_notes';

/** Те, що зробила б міграція плагіна: власна таблиця + гранти ролям. */
const PLUGIN_MIGRATION = `
  create table public.${TABLE} (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    sort_order integer not null default 0,
    is_active boolean not null default true
  );
  grant select on table public.${TABLE} to app_user;
  grant select, insert, update, delete on table public.${TABLE} to app_admin;
  insert into public.plugins (name, display_name, version, is_active)
    values ('${PLUGIN}', 'Test Kit', '1.0.0', true);
`;

describe('порт даних плагіна проти живого Postgres', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_plugin_port');
  let dbUrl: string;

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applySqlFiles(
      dbUrl,
      readdirSync(CANON_DIR)
        .filter((name) => name.endsWith('.sql'))
        .sort()
        .map((name) => join(CANON_DIR, name)),
    );
    await queryRows(dbUrl, PLUGIN_MIGRATION);
    process.env.DATABASE_URL = withUser(dbUrl, 'app_runtime');
  }, 120_000);

  afterAll(async () => {
    await closeDbPool();
    delete process.env.DATABASE_URL;
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  it('плагін читає й пише ВЛАСНУ plg_-таблицю', async () => {
    const created = await insertPluginRow(PLUGIN, TABLE, {
      title: 'Перша',
      sort_order: 2,
    });
    await insertPluginRow(PLUGIN, TABLE, {
      title: 'Друга',
      sort_order: 1,
      is_active: false,
    });

    const ordered = await selectPluginRows(PLUGIN, TABLE, {
      orderBy: 'sort_order',
    });
    expect(ordered.map((row) => row.title)).toEqual(['Друга', 'Перша']);

    const filtered = await selectPluginRows(PLUGIN, TABLE, {
      eq: { is_active: true },
    });
    expect(filtered.map((row) => row.title)).toEqual(['Перша']);

    const patched = await updatePluginRow(PLUGIN, TABLE, created.id as string, {
      title: 'Оновлена',
    });
    expect(patched.title).toBe('Оновлена');

    await deletePluginRow(PLUGIN, TABLE, created.id as string);
    expect(await selectPluginRows(PLUGIN, TABLE)).toHaveLength(1);
  });

  it('таблиця ядра НЕ читається портом — і не доходить до БД', async () => {
    for (const table of ['orders', 'products', 'users', 'user_roles']) {
      await expect(selectPluginRows(PLUGIN, table)).rejects.toThrow(
        /не володіє/,
      );
    }
    // Чужа plg_-таблиця — теж чужа: префікса `plg_` самого по собі мало.
    await expect(selectPluginRows('faq', TABLE)).rejects.toThrow(/не володіє/);
  });

  it('незареєстрований плагін не дістає навіть таблицю з правильним іменем', async () => {
    await expect(selectPluginRows('ghost', 'plg_ghost_items')).rejects.toThrow(
      /не зареєстрований/,
    );
  });

  it('конфіг плагіна: читання публічне, запис — лише адміну', async () => {
    expect(await selectPluginConfig(PLUGIN)).toEqual({
      found: true,
      config: {},
    });
    expect(await selectPluginConfig('ghost')).toEqual({
      found: false,
      config: {},
    });

    expect(await savePluginConfig(PLUGIN, { maxVisible: 7 }, false)).toBe(
      false,
    );
    expect(await selectPluginConfig(PLUGIN)).toEqual({
      found: true,
      config: {},
    });

    expect(await savePluginConfig(PLUGIN, { maxVisible: 7 }, true)).toBe(true);
    expect(await selectPluginConfig(PLUGIN)).toEqual({
      found: true,
      config: { maxVisible: 7 },
    });
  });
});
