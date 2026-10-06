import { eq } from 'drizzle-orm';
import { setResponseStatus } from '@tanstack/react-start/server';
import { requireGrant } from 'simplycms/auth';
import { plugins } from 'simplycms/schema';
import {
  withStorefrontDb,
  withStoreOperatorDb,
  type JsonValue,
} from 'simplycms/storefront/loaders';

/**
 * Конфіг плагіна — рядок `plugins.config`. Читає будь-хто (грант SELECT на
 * `plugins` має й анонім), пише лише `settings.manage`.
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

/** Стеля серіалізованого конфігу (Е6б-13): jsonb рядка не росте без меж. */
export const PLUGIN_CONFIG_MAX_BYTES = 64 * 1024;

/**
 * Записати конфіг плагіна (Е6б-13).
 *
 * 🔴 Право дає матриця (`settings.manage`), а не ad-hoc `isAdminRequest`:
 * не-адмін отримує `AuthzError` (403) — клієнт (`usePluginConfig.save`)
 * перетворює саме його на `false`, а решту помилок пропускає. Право —
 * ПЕРШИМ: розмір конфігу чужому запиту не розкривається.
 *
 * Стеля — 400 зі звичайним `Error`: це зовнішній контракт plugin-sdk
 * (`UNWRAPPED_BY_DESIGN` гарда валідаторів), а не форма адмінки.
 */
export async function savePluginConfig(
  pluginName: string,
  config: Record<string, JsonValue>,
): Promise<void> {
  await requireGrant('settings.manage');
  const size = new TextEncoder().encode(JSON.stringify(config)).byteLength;
  if (size > PLUGIN_CONFIG_MAX_BYTES) {
    setResponseStatus(400);
    // Англійською: серверна діагностика для автора плагіна, не рядок
    // інтерфейсу (гейт i18n-coverage не пускає кирилицю в нові рядки).
    throw new Error(
      `[plugin-sdk] config of plugin ${pluginName} exceeds 64 KB (${size} bytes)`,
    );
  }

  await withStoreOperatorDb((db) =>
    db
      .update(plugins)
      .set({ config, updatedAt: new Date() })
      .where(eq(plugins.name, pluginName)),
  );
}
