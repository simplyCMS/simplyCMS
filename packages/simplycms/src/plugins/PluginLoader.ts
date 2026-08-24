import { listActivePlugins } from 'simplycms/plugins/server';
import { hookRegistry } from './HookRegistry';
import type { Plugin, PluginModule } from './types';

// Map of available plugins (populated by dynamic imports on bootstrap)
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
export function removePluginHooks(pluginName: string): void {
  for (const hookName of hookRegistry.getRegisteredHooks()) {
    hookRegistry.unregister(hookName, pluginName);
  }
}

/**
 * Увімкнути в реєстрі хуки плагінів, позначених активними в БД.
 *
 * 🔴 Список приходить serverFn-ом (`simplycms/plugins/server`), а не запитом
 * із браузера: у контурі v2 браузер до БД не звертається взагалі. Тут же й
 * причина, чому модуль більше не приймає Supabase-клієнта.
 *
 * Активний у БД, але невідомий модуль (магазин видалив пакет, рядок лишився)
 * не валить застосунок — помилка логується, плагін пропускається (спека §8).
 */
export async function loadPlugins(): Promise<Plugin[]> {
  let plugins: Plugin[];
  try {
    plugins = await listActivePlugins();
  } catch (error) {
    console.error('Error loading plugins:', error);
    return [];
  }

  const loadedPlugins: Plugin[] = [];

  for (const plugin of plugins) {
    const pluginModule = pluginModules.get(plugin.name);

    if (!pluginModule) {
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
