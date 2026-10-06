import { hookRegistry } from './HookRegistry';
import { getRegisteredPluginModules, removePluginHooks } from './PluginLoader';

/**
 * Привести `HookRegistry` вкладки у відповідність до `is_active` плагіна
 * (Е6б-17). Без БД: рядок `plugins` уже записав serverFn `setPluginActive`,
 * а серверна операція реєстр браузера змінити не може — тому синхронізацію
 * робить клієнт ПІСЛЯ відповіді сервера.
 *
 * Вмикання: `register` модуля. Якщо він впав — частково зареєстровані хуки
 * знімаються і помилка летить далі: викликач мусить повернути
 * `is_active = false`, інакше БД і вкладка розійдуться.
 *
 * Вимикання не кидає: хуки знімаються в будь-якому разі, бо в БД плагін уже
 * вимкнений, а збій `unregister` лише логується.
 */
export async function syncPluginHooks(
  name: string,
  isActive: boolean,
): Promise<void> {
  const pluginModule = getRegisteredPluginModules().get(name);

  if (isActive) {
    if (!pluginModule)
      throw new Error(`Plugin module "${name}" is not registered`);
    try {
      pluginModule.register(hookRegistry);
    } catch (error) {
      removePluginHooks(name);
      throw error;
    }
    return;
  }

  try {
    pluginModule?.unregister?.(hookRegistry);
  } catch (error) {
    console.error(`Error deactivating plugin "${name}":`, error);
  }
  removePluginHooks(name);
}
