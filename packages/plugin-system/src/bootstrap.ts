import type { SupabaseClient } from '@supabase/supabase-js';
import { registerPluginModule, loadPlugins } from './PluginLoader';
import type { PluginModule } from './types';

/** Опис плагіна в конфізі магазину: імʼя + ліниве завантаження модуля. */
export interface PluginRegistration {
  name: string;
  module: () => Promise<{ default: PluginModule }>;
}

/** Рядок, який bootstrap вставляє в `plugins` для ще невідомого магазину. */
interface PluginInsert {
  name: string;
  display_name: string;
  version: string;
  description: string | null;
  author: string | null;
  is_active: boolean;
}

function toInsert(name: string, module: PluginModule): PluginInsert {
  // `manifest` у PluginModule опційний — падати назад на імʼя з конфіга.
  const manifest = module.manifest;
  return {
    name,
    display_name: manifest?.displayName ?? name,
    version: manifest?.version ?? '0.0.0',
    description: manifest?.description ?? null,
    author: manifest?.author ?? null,
    is_active: false,
  };
}

/**
 * Дописує в таблицю `plugins` рядки для модулів, яких там ще немає, —
 * інакше адмінка не побачила б встановлений через конфіг плагін.
 *
 * Спершу SELECT, і лише потім INSERT відсутніх: RLS дозволяє читати всім,
 * а писати — лише адміну (політика `Admins can manage plugins`). Тому запис
 * навіть не пробуємо без сесії: анонімний відвідувач інакше отримував би
 * гарантований RLS-фейл у консолі на кожному завантаженні сторінки. Рядок
 * зʼявиться, щойно на сайт зайде адмін — тобто рівно тоді, коли він потрібен.
 */
async function syncPluginRows(
  modules: Map<string, PluginModule>,
  supabase: SupabaseClient,
): Promise<void> {
  if (modules.size === 0) return;

  const { data, error } = await supabase.from('plugins').select('name');
  if (error) {
    console.error('[plugins] Не вдалося прочитати таблицю plugins:', error);
    return;
  }

  const known = new Set(
    ((data ?? []) as { name: string }[]).map((row) => row.name),
  );
  const missing = [...modules.entries()]
    .filter(([name]) => !known.has(name))
    .map(([name, module]) => toInsert(name, module));

  if (missing.length === 0) return;

  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) return;

  const { error: insertError } = await supabase.from('plugins').insert(missing);
  if (insertError) {
    console.error(
      '[plugins] Не вдалося зареєструвати плагіни в БД:',
      insertError,
    );
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
  supabase: SupabaseClient,
): Promise<void> {
  const modules = new Map<string, PluginModule>();

  for (const reg of regs) {
    try {
      const loaded = await reg.module();
      registerPluginModule(reg.name, loaded.default);
      modules.set(reg.name, loaded.default);
    } catch (error) {
      console.error(`[plugins] Модуль "${reg.name}" не імпортувався:`, error);
    }
  }

  await syncPluginRows(modules, supabase);
  await loadPlugins(supabase);
}
