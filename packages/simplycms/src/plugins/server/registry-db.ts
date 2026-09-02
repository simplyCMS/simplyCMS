import { randomUUID } from 'node:crypto';
import { asc, eq } from 'drizzle-orm';
import { plugins } from 'simplycms/schema';
import {
  withStorefrontDb,
  withStoreOperatorDb,
} from 'simplycms/storefront/loaders';
import type { PluginBootstrapRow, PluginJson, PluginRecord } from '../types';

/**
 * Доступ до таблиці `plugins` для bootstrap-у вітрини — ЗВИЧАЙНІ функції.
 *
 * 🔴 Окремо від `./index` із тієї ж причини, що й у тем: Start вирізає з
 * клієнтського бандла лише тіла serverFn-хендлерів, тож живий експорт поруч
 * тримав би живим пул Postgres.
 */

/** Мапа select-а: ключі — snake_case, бо саме так рантайм читає рядок. */
const pluginColumns = {
  id: plugins.id,
  name: plugins.name,
  display_name: plugins.displayName,
  version: plugins.version,
  description: plugins.description,
  author: plugins.author,
  is_active: plugins.isActive,
  config: plugins.config,
  hooks: plugins.hooks,
  migrations_applied: plugins.migrationsApplied,
  installed_at: plugins.installedAt,
  updated_at: plugins.updatedAt,
};

/** Імена плагінів, уже відомі БД. */
export async function selectPluginNames(): Promise<string[]> {
  const rows = await withStorefrontDb((db) =>
    db.select({ name: plugins.name }).from(plugins).orderBy(asc(plugins.name)),
  );
  return rows.map((row) => row.name);
}

/**
 * Активні плагіни в порядку встановлення — те, що рантайм вмикає в реєстрі.
 *
 * 🔴 `is_active` фільтрується КОДОМ: у моделі B5″ RLS на `plugins` немає,
 * роль `app_user` має SELECT на всю таблицю. Активність — правило показу, а
 * не право доступу (та сама конвенція, що в каталозі).
 */
export async function selectActivePlugins(): Promise<PluginRecord[]> {
  const rows = await withStorefrontDb((db) =>
    db
      .select(pluginColumns)
      .from(plugins)
      .where(eq(plugins.isActive, true))
      .orderBy(asc(plugins.installedAt)),
  );

  // Колонки `is_active`/дат у схемі nullable (дефолти на боці БД) — рантайм
  // же обіцяє плоский рядок без `null` у цих полях.
  return rows.map((row) => ({
    ...row,
    is_active: row.is_active ?? false,
    installed_at: row.installed_at ?? '',
    updated_at: row.updated_at ?? '',
    config: (row.config ?? {}) as PluginJson,
    hooks: (row.hooks ?? []) as PluginJson,
    migrations_applied: (row.migrations_applied ?? []) as PluginJson,
  }));
}

/**
 * Дописати рядки плагінів, яких у БД ще немає.
 *
 * 🔴 `isAdmin` рахує СЕРВЕР. Грант INSERT на `plugins` має лише `app_admin`,
 * і саме ця перевірка — рубіж; прапорець із браузера лише економить виклик.
 * Повертає кількість вставлених рядків; `-1` — відмова доступу.
 */
export async function insertMissingPlugins(
  rows: readonly PluginBootstrapRow[],
  isAdmin: boolean,
): Promise<number> {
  if (!isAdmin) return -1;
  if (rows.length === 0) return 0;

  const known = new Set(await selectPluginNames());
  const missing = rows.filter((row) => !known.has(row.name));
  if (missing.length === 0) return 0;

  await withStoreOperatorDb((db) =>
    db.insert(plugins).values(
      missing.map((row) => ({
        id: randomUUID(),
        name: row.name,
        displayName: row.display_name,
        version: row.version,
        description: row.description,
        author: row.author,
        // Без hooks рядок від bootstrap був біднішим за рядок від сіду —
        // адмінка показувала б порожній список хуків встановленого плагіна.
        hooks: row.hooks,
        isActive: false,
      })),
    ),
  );

  return missing.length;
}
