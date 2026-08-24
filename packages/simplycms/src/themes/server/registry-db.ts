import { asc } from 'drizzle-orm';
import { themes } from 'simplycms/schema';
import {
  withStorefrontDb,
  withStoreOperatorDb,
} from 'simplycms/storefront/loaders';
import type { ThemeBootstrapRow } from '../types';

/**
 * Доступ до таблиці `themes` для bootstrap-у — ЗВИЧАЙНІ функції (B9/В2).
 *
 * 🔴 Модуль навмисно окремий від `./index`, де живуть serverFn-обгортки.
 * Трансформація TanStack Start вирізає з клієнтського бандла тіла хендлерів
 * разом із їхніми імпортами; живий не-serverFn експорт поруч затягнув би
 * сюди пул Postgres (той самий урок, що дав `storefront-routes/server/is-admin`).
 * Тести теж імпортують саме звідси: контексту `createServerFn` у них немає.
 */

/** Імена тем, уже відомі БД. Читає роль `app_user` — грант SELECT є у всіх. */
export async function selectThemeNames(): Promise<string[]> {
  const rows = await withStorefrontDb((db) =>
    db.select({ name: themes.name }).from(themes).orderBy(asc(themes.name)),
  );
  return rows.map((row) => row.name);
}

/**
 * Дописати рядки тем, яких у БД ще немає.
 *
 * 🔴 `isAdmin` рахує СЕРВЕР (`isAdminRequest` у обгортці), а не клієнт:
 * прапорець `canWrite` у браузері лише економить зайвий виклик, довіряти
 * йому не можна за побудовою. Грант INSERT на `themes` має тільки
 * `app_admin`, тож без цієї перевірки транзакція впала б «permission denied» —
 * але впала б ПІСЛЯ того, як хендлер уже пустив чужий запит у БД.
 *
 * Повертає кількість вставлених рядків; `-1` — відмова доступу (виклик
 * приходить із bootstrap-у в ефекті, тож кидати назовні тут нічого).
 */
export async function insertMissingThemes(
  rows: readonly ThemeBootstrapRow[],
  isAdmin: boolean,
): Promise<number> {
  if (!isAdmin) return -1;
  if (rows.length === 0) return 0;

  const known = new Set(await selectThemeNames());
  const missing = rows.filter((row) => !known.has(row.name));
  if (missing.length === 0) return 0;

  await withStoreOperatorDb((db) =>
    db.insert(themes).values(
      missing.map((row) => ({
        name: row.name,
        displayName: row.display_name,
        version: row.version,
        description: row.description,
        author: row.author,
        // Активність — рішення адміна в адмінці, а не побічний ефект
        // встановлення пакета. Крім того, частковий унікальний індекс
        // `themes_active_idx` не дав би вставити другу активну.
        isActive: false,
      })),
    ),
  );

  return missing.length;
}
