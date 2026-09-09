import { eq } from 'drizzle-orm';
import { plugins } from 'simplycms/schema';
import { withStorefrontDb } from 'simplycms/storefront/loaders';

/**
 * Межа даних плагіна (спека §7, рішення B9) — ЧИСТА частина.
 *
 * 🔴 Гард обовʼязково серверний. Раніше префікс `plg_` перевіряв хук у
 * браузері, а доступ обмежувала RLS: імʼя таблиці все одно їхало в PostgREST,
 * і межу тримала база. У контурі v2 бази на тому кінці немає — запит виконує
 * НАШ хендлер під роллю магазину. Тобто якби імʼя таблиці не перевірялося
 * тут, плагін прочитав би `orders` чи `users` рівно тим самим викликом.
 */

/** Ідентифікатор SQL, який гард узагалі згоден підставити в запит. */
const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

/** Ключ плагіна в іменах таблиць: `hello-world` → `hello_world`. */
export function tablePrefix(pluginName: string): string {
  return `plg_${pluginName.toLowerCase().replace(/-/g, '_')}`;
}

/** Колонка у фільтрі/сортуванні. Кидає — інакше імʼя пішло б у SQL як є. */
export function assertColumn(column: string): string {
  if (!IDENTIFIER.test(column)) {
    throw new Error(
      `[plugin-sdk] Недопустиме імʼя колонки: ${JSON.stringify(column)}`,
    );
  }
  return column;
}

/**
 * Перевірити, що `table` — ВЛАСНА таблиця плагіна `pluginName`.
 *
 * Два незалежні критерії, обидва обовʼязкові:
 *   1) імʼя = `plg_<ключ плагіна>` або `plg_<ключ плагіна>_<…>` — префікса
 *      `plg_` самого по собі мало: він пустив би плагін у таблицю СУСІДА;
 *   2) плагін відомий магазину — рядок у `plugins` існує. Це і є «манифест»
 *      на боці сервера: реєстр модулів у браузері, і вірити його імені
 *      хендлер не може.
 */
export function assertOwnTable(pluginName: string, table: string): string {
  if (!IDENTIFIER.test(table)) {
    throw new Error(
      `[plugin-sdk] Недопустиме імʼя таблиці: ${JSON.stringify(table)}`,
    );
  }

  const prefix = tablePrefix(pluginName);
  if (table !== prefix && !table.startsWith(`${prefix}_`)) {
    throw new Error(
      `[plugin-sdk] Плагін "${pluginName}" не володіє таблицею "${table}": ` +
        `порт працює лише з "${prefix}" і "${prefix}_*" (спека §7).`,
    );
  }

  return table;
}

/** Чи знає магазин про такий плагін (рядок у `plugins`). */
export async function assertKnownPlugin(pluginName: string): Promise<void> {
  const [row] = await withStorefrontDb((db) =>
    db
      .select({ name: plugins.name })
      .from(plugins)
      .where(eq(plugins.name, pluginName))
      .limit(1),
  );

  if (!row) {
    throw new Error(
      `[plugin-sdk] Плагін "${pluginName}" не зареєстрований у магазині — ` +
        `порт даних недоступний.`,
    );
  }
}
