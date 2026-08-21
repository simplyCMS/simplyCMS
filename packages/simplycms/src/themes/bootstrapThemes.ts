import type { SupabaseClient } from '@supabase/supabase-js';
import { ThemeRegistry } from './ThemeRegistry';
import type { ThemeModule } from './types';

/** Рядок, який bootstrap вставляє в `themes` для ще невідомого магазину. */
interface ThemeInsert {
  name: string;
  display_name: string;
  version: string;
  description: string | null;
  author: string | null;
  is_active: boolean;
}

/** Ліміт колонки `themes.version` — varchar(20) (packages/simplycms/src/schema/schema.ts). */
const VERSION_MAX_LENGTH = 20;

/**
 * Версія в межах колонки. Задовгий рядок (prerelease-конвенції npm цілком
 * законно дають більше за 20 символів) інакше валив би ВЕСЬ batch INSERT —
 * усупереч інваріанту «помилка однієї теми не заважає решті».
 */
function fitVersion(name: string, version: string): string {
  if (version.length <= VERSION_MAX_LENGTH) return version;
  console.warn(
    `[themes] Версію теми '${name}' обрізано до ${VERSION_MAX_LENGTH} символів ` +
      `(ліміт колонки themes.version): ${version}`,
  );
  return version.slice(0, VERSION_MAX_LENGTH);
}

/**
 * Рядок БД будується з маніфеста теми.
 *
 * `name` — це КЛЮЧ реєстрації, а не `manifest.name`: саме за ключем резолвить
 * `getActiveThemeSSR`, тож рядок мусить нести його. `description`/`author`
 * лишаються порожніми свідомо — контракт `ThemeManifest` (types.ts) таких
 * полів не має, а вигадувати їх із назви пакета було б брехнею в адмінці.
 */
function toInsert(name: string, theme: ThemeModule): ThemeInsert {
  return {
    name,
    display_name: theme.manifest.displayName,
    version: fitVersion(name, theme.manifest.version),
    description: null,
    author: null,
    // Активність — рішення адміна. Крім того, `themes_active_idx` (частковий
    // унікальний індекс по is_active = true) не дав би вставити другу активну.
    is_active: false,
  };
}

/**
 * Дописує в таблицю `themes` рядки для зареєстрованих тем, яких там ще немає, —
 * інакше адмінка не побачила б встановлену через конфіг тему (вона читає
 * ЛИШЕ БД).
 *
 * Порядок кроків обраний так, щоб типовий випадок («усі теми вже в БД»)
 * коштував рівно один SELECT:
 *   1) SELECT імен (RLS дозволяє читати всім) → `missing`;
 *   2) порожньо → вихід ДО будь-якої іншої роботи;
 *   3) session-гард: писати може лише адмін (політика `Admins can manage
 *      themes`), тож без сесії навіть не пробуємо — анонім інакше діставав би
 *      гарантований RLS-фейл у консолі на кожному завантаженні сторінки;
 *   4) `ThemeRegistry.load` лише для missing — чанки тем тягнуться тільки у
 *      рідкісному вікні «тему додано, адмін ще не заходив»;
 *   5) один batch INSERT.
 *
 * 🔴 Чесна межа (симетрична плагінному `syncPluginRows`): залогінений НЕ-адмін
 * у тому самому вікні пройде session-гард, потягне чанки і отримає RLS-відмову
 * INSERT → `console.error`. Приймається свідомо; деталі — docs/architecture/themes.md.
 *
 * Помилки не кидаються назовні: bootstrap викликається з ефекту в корені
 * застосунку, і падіння тут не має валити сторінку.
 */
export async function bootstrapThemes(supabase: SupabaseClient): Promise<void> {
  const registered = ThemeRegistry.getRegisteredThemes();
  if (registered.length === 0) return;

  const { data, error } = await supabase.from('themes').select('name');
  if (error) {
    console.error('[themes] Не вдалося прочитати таблицю themes:', error);
    return;
  }

  const known = new Set(
    ((data ?? []) as { name: string }[]).map((row) => row.name),
  );
  const missing = registered.filter((name) => !known.has(name));
  if (missing.length === 0) return;

  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) return;

  const rows = await loadRows(missing);
  if (rows.length === 0) return;

  const { error: insertError } = await supabase.from('themes').insert(rows);
  if (insertError) {
    console.error('[themes] Не вдалося зареєструвати теми в БД:', insertError);
  }
}

/**
 * Завантажує модулі відсутніх тем і перетворює їх на рядки БД.
 *
 * Помилка однієї теми (зламаний модуль, провалена валідація) логується і НЕ
 * заважає решті потрапити в БД — та сама мʼяка політика, що в плагінів.
 */
async function loadRows(missing: string[]): Promise<ThemeInsert[]> {
  const rows: ThemeInsert[] = [];

  for (const name of missing) {
    try {
      const theme = await ThemeRegistry.load(name);
      // Ключ реєстрації — це ідентичність теми для БД і для резолву активної.
      // Розбіжність із manifest.name не валить реєстрацію, але робить
      // налаштування «мовчки не тими» — тому warn (дзеркало bootstrapPlugins).
      if (theme.manifest.name !== name) {
        console.warn(
          `[themes] Ключ конфігу '${name}' ≠ manifest.name '${theme.manifest.name}' — рядок у БД зберігається під ключем конфігу`,
        );
      }
      rows.push(toInsert(name, theme));
    } catch (loadError) {
      console.error(`[themes] Тему "${name}" не підключено:`, loadError);
    }
  }

  return rows;
}
