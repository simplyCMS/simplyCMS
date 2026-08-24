import { listPluginNames, registerPlugins } from 'simplycms/plugins/server';
import { registerPluginModule, loadPlugins } from './PluginLoader';
import { validatePluginModule } from './validatePluginModule';
import type { PluginBootstrapRow, PluginModule } from './types';

/** Опис плагіна в конфізі магазину: імʼя + ліниве завантаження модуля. */
export interface PluginRegistration {
  name: string;
  module: () => Promise<{ default: PluginModule }>;
}

function toRow(name: string, module: PluginModule): PluginBootstrapRow {
  // `manifest` у PluginModule опційний — падати назад на імʼя з конфіга.
  const manifest = module.manifest;
  return {
    name,
    display_name: manifest?.displayName ?? name,
    version: manifest?.version ?? '0.0.0',
    description: manifest?.description ?? null,
    author: manifest?.author ?? null,
    // Без hooks рядок від bootstrap був біднішим за рядок від сіду —
    // адмінка показувала б порожній список хуків встановленого плагіна.
    hooks: manifest?.hooks ?? [],
  };
}

/**
 * Дописує в таблицю `plugins` рядки для модулів, яких там ще немає, —
 * інакше адмінка не побачила б встановлений через конфіг плагін.
 *
 * Спершу читання імен, і лише потім запис відсутніх: читає будь-хто, пише
 * лише адмін. Рядок зʼявиться, щойно на сайт зайде адмін — тобто рівно тоді,
 * коли він потрібен.
 *
 * 🔴 `canWrite` — підказка, а не рубіж: право перевіряє серверний хендлер
 * `registerPlugins` із сесії запиту. Тут прапорець економить анонімові
 * гарантовано відмовний виклик на кожному завантаженні сторінки.
 */
async function syncPluginRows(
  modules: Map<string, PluginModule>,
  canWrite: boolean,
): Promise<void> {
  if (modules.size === 0) return;

  let known: Set<string>;
  try {
    known = new Set(await listPluginNames());
  } catch (error) {
    console.error('[plugins] Не вдалося прочитати таблицю plugins:', error);
    return;
  }

  const missing = [...modules.entries()]
    .filter(([name]) => !known.has(name))
    .map(([name, module]) => toRow(name, module));

  if (missing.length === 0) return;

  if (!canWrite) return;

  try {
    await registerPlugins({ data: { rows: missing } });
  } catch (error) {
    console.error('[plugins] Не вдалося зареєструвати плагіни в БД:', error);
  }
}

/**
 * Підключає плагіни магазину: реєструє модулі з конфіга, синхронізує їх
 * із таблицею `plugins` і вмикає ті, що позначені активними в БД.
 *
 * Активний у БД, але невідомий модуль (магазин видалив пакет, рядок лишився)
 * не валить застосунок — `loadPlugins` логує помилку й пропускає його.
 */
export async function bootstrapPlugins(
  regs: PluginRegistration[],
  canWrite: boolean,
): Promise<void> {
  const modules = new Map<string, PluginModule>();

  for (const reg of regs) {
    try {
      const loaded = await reg.module();
      // Мʼяка політика (спека §8 «ніяких падінь») забезпечується тут:
      // порушення контракту валідатор кидає, catch нижче логує і пропускає
      // модуль; попередження (зокрема несумісний engines.simplycms —
      // warn-режим на 0.x, рішення Р5 плану Фази 3) валідатор друкує сам,
      // реєстрація триває.
      validatePluginModule(loaded.default);
      // Ключ конфігу — це і ключ рядка в таблиці plugins, і те, що плагін
      // передає в usePluginConfig як manifest.name. Розбіжність не валить
      // реєстрацію, але робить налаштування «мовчки не тими» — тому warn.
      const manifestName = loaded.default.manifest?.name;
      if (manifestName !== undefined && manifestName !== reg.name) {
        console.warn(
          `[plugins] Ключ конфігу '${reg.name}' ≠ manifest.name '${manifestName}' — налаштування плагіна читатимуться з іншого рядка plugins`,
        );
      }
      registerPluginModule(reg.name, loaded.default);
      modules.set(reg.name, loaded.default);
    } catch (error) {
      console.error(`[plugins] Модуль "${reg.name}" не підключено:`, error);
    }
  }

  await syncPluginRows(modules, canWrite);
  await loadPlugins();
}
