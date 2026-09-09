import type { SupabaseClient } from '@supabase/supabase-js';
import { getRegisteredPluginModules, removePluginHooks } from './PluginLoader';
import { hookRegistry } from './HookRegistry';
import { deletePluginRow, setPluginActive } from './pluginRepository';

/**
 * Lifecycle плагіна з АДМІНКИ: вмикання, вимикання, видалення рядка.
 *
 * 🔴 Живе окремо від `PluginLoader` навмисно. Адмінка — єдиний контур, який
 * усе ще ходить у БД через supabase-js (контур v2 її ще не перевів), і поки
 * ці функції стояли поруч із `loadPlugins`, барель `simplycms/plugins` тягнув
 * PostgREST у КОЖЕН чанк вітрини: bootstrap кореня імпортує саме його. Розділ
 * файлів робить межу видимою бандлеру, а не лише читачеві.
 *
 * 🔴 Наслідок: разом із адмінкою ці функції сьогодні НЕ працюють проти
 * контуру v2 (роль `app_runtime` PostgREST не має). Це прийнятий борг —
 * переведення адмінки на serverFn йде окремим треком.
 */

/**
 * Активація плагіна. 🔴 Порядок атомарний: спершу БД, і ТІЛЬКИ після
 * підтвердженого запису — мутація HookRegistry. Зворотний порядок лишав би
 * «привидні» хуки в памʼяті, якби БД відмовила.
 */
export async function activatePlugin(
  supabase: SupabaseClient,
  pluginName: string,
): Promise<boolean> {
  const pluginModule = getRegisteredPluginModules().get(pluginName);

  if (!pluginModule) {
    console.error(`Plugin module "${pluginName}" not found`);
    return false;
  }

  const written = await setPluginActive(supabase, pluginName, true);
  if (!written) return false;

  try {
    pluginModule.register(hookRegistry);
    return true;
  } catch (err) {
    console.error(`Error activating plugin "${pluginName}":`, err);
    // Реєстрація впала — чистимо часткові хуки й повертаємо БД у попередній стан.
    removePluginHooks(pluginName);
    await setPluginActive(supabase, pluginName, false);
    return false;
  }
}

/**
 * Деактивація плагіна. Той самий атомарний порядок: БД → `unregister` модуля →
 * зняття решти хуків. Відмова БД лишає реєстр незміненим.
 */
export async function deactivatePlugin(
  supabase: SupabaseClient,
  pluginName: string,
): Promise<boolean> {
  const written = await setPluginActive(supabase, pluginName, false);
  if (!written) return false;

  const pluginModule = getRegisteredPluginModules().get(pluginName);

  try {
    pluginModule?.unregister?.(hookRegistry);
  } catch (err) {
    console.error(`Error deactivating plugin "${pluginName}":`, err);
  }

  // Хуки знімаємо в будь-якому разі: у БД плагін уже вимкнений.
  removePluginHooks(pluginName);
  return true;
}

/** Видалення плагіна: спершу деактивація (знімає хуки), потім рядок. */
export async function uninstallPlugin(
  supabase: SupabaseClient,
  pluginName: string,
): Promise<boolean> {
  await deactivatePlugin(supabase, pluginName);

  return deletePluginRow(supabase, pluginName);
}
