import { listThemeNames, registerThemes } from 'simplycms/themes/server';
import { ThemeRegistry } from './ThemeRegistry';
import type { ThemeBootstrapRow, ThemeModule } from './types';

/** Ліміт колонки `themes.version` — varchar(20) (`schema/schema.ts`). */
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
 * активну тему лоадер каркаса, тож рядок мусить нести його.
 * `description`/`author` лишаються порожніми свідомо — контракт
 * `ThemeManifest` (types.ts) таких полів не має, а вигадувати їх із назви
 * пакета було б брехнею в адмінці.
 */
function toRow(name: string, theme: ThemeModule): ThemeBootstrapRow {
  return {
    name,
    display_name: theme.manifest.displayName,
    version: fitVersion(name, theme.manifest.version),
    description: null,
    author: null,
  };
}

/**
 * Дописує в таблицю `themes` рядки для зареєстрованих тем, яких там ще немає, —
 * інакше адмінка не побачила б встановлену через конфіг тему (вона читає
 * ЛИШЕ БД).
 *
 * Порядок кроків обраний так, щоб типовий випадок («усі теми вже в БД»)
 * коштував рівно один запит:
 *   1) `listThemeNames()` → `missing`;
 *   2) порожньо → вихід ДО будь-якої іншої роботи;
 *   3) гард `canWrite` — ЛИШЕ економія виклику (див. нижче);
 *   4) `ThemeRegistry.load` тільки для missing — чанки тем тягнуться тільки
 *      у рідкісному вікні «тему додано, адмін ще не заходив»;
 *   5) один `registerThemes`.
 *
 * 🔴 `canWrite` — підказка, а не рубіж. Право на INSERT перевіряє СЕРВЕР
 * (`registerThemes` → `isAdminRequest` із сесії запиту), бо прапорець із
 * браузера підмінюється тривіально. Тут він потрібен рівно для того, щоб
 * анонім не робив гарантовано відмовний виклик на кожному завантаженні.
 *
 * Помилки не кидаються назовні: bootstrap викликається з ефекту в корені
 * застосунку, і падіння тут не має валити сторінку.
 */
export async function bootstrapThemes(canWrite: boolean): Promise<void> {
  const registered = ThemeRegistry.getRegisteredThemes();
  if (registered.length === 0) return;

  let known: Set<string>;
  try {
    known = new Set(await listThemeNames());
  } catch (error) {
    console.error('[themes] Не вдалося прочитати таблицю themes:', error);
    return;
  }

  const missing = registered.filter((name) => !known.has(name));
  if (missing.length === 0) return;

  if (!canWrite) return;

  const rows = await loadRows(missing);
  if (rows.length === 0) return;

  try {
    await registerThemes({ data: { rows } });
  } catch (error) {
    console.error('[themes] Не вдалося зареєструвати теми в БД:', error);
  }
}

/**
 * Завантажує модулі відсутніх тем і перетворює їх на рядки БД.
 *
 * Помилка однієї теми (зламаний модуль, провалена валідація) логується і НЕ
 * заважає решті потрапити в БД — та сама мʼяка політика, що в плагінів.
 */
async function loadRows(missing: string[]): Promise<ThemeBootstrapRow[]> {
  const rows: ThemeBootstrapRow[] = [];

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
      rows.push(toRow(name, theme));
    } catch (loadError) {
      console.error(`[themes] Тему "${name}" не підключено:`, loadError);
    }
  }

  return rows;
}
