import { eq } from 'drizzle-orm';
import { themes } from 'simplycms/schema';
import type { Theme } from 'simplycms/schema/types';
import { withStorefrontDb } from './db';
// 🔴 Type-only self-import барелю стирається при збірці — рантайм-циклу немає.
import type { JsonValue } from 'simplycms/storefront/loaders';

/** Запис активної теми у формі, яку читають каркасні роути. */
export interface ThemeRecord {
  id: Theme['id'];
  name: Theme['name'];
  display_name: Theme['displayName'];
  version: Theme['version'];
  description: Theme['description'];
  author: Theme['author'];
  preview_image: Theme['previewImage'];
  is_active: Theme['isActive'];
  settings: Record<string, JsonValue>;
  created_at: string;
  updated_at: string;
}

interface CacheEntry {
  data: ThemeRecord | null;
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 хвилин
let themeCache: CacheEntry | null = null;

/**
 * Прочитати запис активної теми крізь TTL-кеш — ЗВИЧАЙНА функція.
 *
 * Доступна server-route handler-ам і тестам, де контексту `createServerFn`
 * немає. Живе окремо від `./themes` навмисно — з тієї самої причини, що й
 * `checkIsAdmin` (див. докблок у `./is-admin`): живий не-serverFn експорт
 * тримає серверний імпорт живим і затягнув би пул Postgres у клієнтський
 * бандл через сусідній `getActiveTheme`, який імпортує `__root.tsx`.
 *
 * 🔴 Помилка запиту НЕ ковтається. Раніше вона логувалась і кешувала `null`
 * на пʼять хвилин — тобто збій БД на секунду знімав тему з магазину на
 * пʼять і виглядав як «тема злетіла», а не як збій.
 */
export async function loadActiveTheme(): Promise<ThemeRecord | null> {
  const now = Date.now();
  if (themeCache && now - themeCache.timestamp < CACHE_TTL) {
    return themeCache.data;
  }

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

  const data: ThemeRecord | null =
    record === null
      ? null
      : {
          ...record,
          settings: (record.settings ?? {}) as Record<string, JsonValue>,
          created_at: record.created_at ?? new Date().toISOString(),
          updated_at: record.updated_at ?? new Date().toISOString(),
        };

  themeCache = { data, timestamp: now };
  return data;
}

/** Скинути кеш активної теми (перемикання теми чи зміна її налаштувань). */
export function invalidateThemeCache(): void {
  themeCache = null;
}
