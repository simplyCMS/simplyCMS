import { eq } from 'drizzle-orm';
import { plugins } from 'simplycms/schema';
import {
  withStorefrontDb,
  withStoreOperatorDb,
  type JsonValue,
} from 'simplycms/storefront/loaders';

/**
 * Конфіг плагіна — рядок `plugins.config`. Читає будь-хто (грант SELECT на
 * `plugins` має й анонім), пише лише адмін.
 */

/**
 * Значення `config` або `null`, якщо рядка плагіна немає.
 *
 * 🔴 Розрізняти «рядка немає» і «config порожній» обовʼязково: перше — це
 * типовий розсинхрон ключа конфігу з `manifest.name`, і мовчазні дефолти
 * ховали б його (адмінка «успішно» зберігала б налаштування, яких плагін
 * ніколи не побачить).
 */
export async function selectPluginConfig(
  pluginName: string,
): Promise<{ found: boolean; config: JsonValue }> {
  const [row] = await withStorefrontDb((db) =>
    db
      .select({ config: plugins.config })
      .from(plugins)
      .where(eq(plugins.name, pluginName))
      .limit(1),
  );

  return row
    ? { found: true, config: (row.config ?? {}) as JsonValue }
    : { found: false, config: {} };
}

/**
 * Записати конфіг плагіна. `isAdmin` рахує СЕРВЕР — грант UPDATE на
 * `plugins` має лише `app_admin`. Повертає `false`, якщо права немає.
 */
export async function savePluginConfig(
  pluginName: string,
  config: Record<string, JsonValue>,
  isAdmin: boolean,
): Promise<boolean> {
  if (!isAdmin) return false;

  await withStoreOperatorDb((db) =>
    db
      .update(plugins)
      .set({ config, updatedAt: new Date().toISOString() })
      .where(eq(plugins.name, pluginName)),
  );

  return true;
}
