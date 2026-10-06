import { eq } from 'drizzle-orm';
import { themes } from 'simplycms/schema';
import type { JsonValue } from 'simplycms/schema/types';
import { activeThemeCache, type ThemeRecord } from 'simplycms/site';
import { withStorefrontDb } from './db';

// Тип переїхав у `simplycms/site` (Е6б-7), щоб адмінка й вітрина ділили його
// без імпорту `storefront`; тут лишається реекспорт для наявних споживачів.
export type { ThemeRecord };

/** Один запит активної теми без кешу. */
async function readActiveTheme(): Promise<ThemeRecord | null> {
  const record = await withStorefrontDb(async (db) => {
    const [row] = await db
      .select({
        id: themes.id,
        name: themes.name,
        display_name: themes.displayName,
        version: themes.version,
        description: themes.description,
        author: themes.author,
        preview_image: themes.previewImage,
        is_active: themes.isActive,
        settings: themes.settings,
        created_at: themes.createdAt,
        updated_at: themes.updatedAt,
      })
      .from(themes)
      // Активна тема — рівно одна: цього не дає жоден предикат, це частковий
      // унікальний індекс `themes_active_idx`.
      .where(eq(themes.isActive, true))
      .limit(1);

    return row ?? null;
  });

  return record === null
    ? null
    : {
        ...record,
        settings: (record.settings ?? {}) as Record<string, JsonValue>,
        created_at: record.created_at ?? new Date(),
        updated_at: record.updated_at ?? new Date(),
      };
}

/**
 * Прочитати запис активної теми крізь спільний кеш (`activeThemeCache`:
 * TTL 5 хв + покоління) — ЗВИЧАЙНА функція.
 *
 * Доступна server-route handler-ам і тестам, де контексту `createServerFn`
 * немає. Живе окремо від `./themes` навмисно — з тієї самої причини, що й
 * `checkIsAdmin` (див. докблок у `./is-admin`): живий не-serverFn експорт
 * тримає серверний імпорт живим і затягнув би пул Postgres у клієнтський
 * бандл через сусідні serverFn (`getActiveTheme` у каркасних роутах,
 * `getStorefrontRoot` у корені host-а).
 *
 * 🔴 Помилка запиту НЕ ковтається й не кешується. Раніше вона логувалась і
 * кешувала `null` на пʼять хвилин — тобто збій БД на секунду знімав тему з
 * магазину на пʼять і виглядав як «тема злетіла», а не як збій.
 */
export function loadActiveTheme(): Promise<ThemeRecord | null> {
  return activeThemeCache.get(readActiveTheme);
}
