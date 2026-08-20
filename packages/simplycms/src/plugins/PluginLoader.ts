import { hookRegistry } from './HookRegistry';
import {
  deletePluginRow,
  fetchActivePlugins,
  setPluginActive,
} from './pluginRepository';
import type { Plugin, PluginModule } from './types';
import type { SupabaseClient } from '@supabase/supabase-js';

// Map of available plugins (will be populated by dynamic imports)
const pluginModules: Map<string, PluginModule> = new Map();

// Register a plugin module (called during app initialization)
export function registerPluginModule(name: string, module: PluginModule): void {
  pluginModules.set(name, module);
}

// Get all registered plugin modules
export function getRegisteredPluginModules(): Map<string, PluginModule> {
  return pluginModules;
}

/**
 * Зняти всі хуки плагіна з реєстру. `getRegisteredHooks()` віддає снапшот імен,
 * тому мутація реєстру під час обходу безпечна.
 */
function removePluginHooks(pluginName: string): void {
  for (const hookName of hookRegistry.getRegisteredHooks()) {
    hookRegistry.unregister(hookName, pluginName);
  }
}

// Load and activate all active plugins from database
export async function loadPlugins(supabase: SupabaseClient): Promise<Plugin[]> {
  const plugins = await fetchActivePlugins(supabase);
  if (!plugins) return [];

  const loadedPlugins: Plugin[] = [];

  for (const plugin of plugins) {
    const pluginModule = pluginModules.get(plugin.name);

    if (!pluginModule) {
      // spec §8: активний у БД, але невідомий модуль — помилка + пропуск.
      console.error(
        `Plugin module "${plugin.name}" not found in registry — skipped`,
      );
      continue;
    }

    try {
      pluginModule.register(hookRegistry);
      loadedPlugins.push(plugin);
    } catch (err) {
      console.error(`Error loading plugin "${plugin.name}":`, err);
      removePluginHooks(plugin.name);
    }
  }

  return loadedPlugins;
}

/**
 * Активація плагіна. 🔴 Порядок атомарний: спершу БД, і ТІЛЬКИ після
 * підтвердженого запису — мутація HookRegistry. Зворотний порядок лишав би
 * «привидні» хуки в памʼяті, якби БД відмовила.
 */
export async function activatePlugin(
  supabase: SupabaseClient,
  pluginName: string,
): Promise<boolean> {
  const pluginModule = pluginModules.get(pluginName);

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

  const pluginModule = pluginModules.get(pluginName);

  try {
    pluginModule?.unregister?.(hookRegistry);
  } catch (err) {
    console.error(`Error deactivating plugin "${pluginName}":`, err);
  }

  // Хуки знімаємо в будь-якому разі: у БД плагін уже вимкнений.
  removePluginHooks(pluginName);
  return true;
}

// Uninstall a plugin (remove from database)
export async function uninstallPlugin(
  supabase: SupabaseClient,
  pluginName: string,
): Promise<boolean> {
  // First deactivate — знімає хуки з реєстру.
  await deactivatePlugin(supabase, pluginName);

  return deletePluginRow(supabase, pluginName);
}
