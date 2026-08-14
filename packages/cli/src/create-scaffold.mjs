// Розгортання шаблонів `simplycms create` (плагін — Фаза 3, тема — Фаза 4).
// Виділено з create.mjs заради ліміту рядків: тут — чисті функції над файлами
// (шляхи шаблонів, підстановка плейсхолдерів, рекурсивна копія), у create.mjs —
// парсер аргументів і сценарій команди.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Службові перейменування шаблону (той самий прийом, що в скаффолдері магазину). */
const RENAMES = { 'package.json.tpl': 'package.json' };

/** @param {string} name */
const templateDir = (name) =>
  join(dirname(fileURLToPath(import.meta.url)), '..', name);

/** Тека шаблону плагіна в пакеті CLI. */
export const templatePluginDir = () => templateDir('template-plugin');

/** Тека шаблону теми в пакеті CLI. */
export const templateThemeDir = () => templateDir('template-theme');

/**
 * Підстановка плейсхолдерів шаблону плагіна. Окремий плейсхолдер префікса
 * таблиць: для імен із дефісом (`my-faq`) SQL-префікс — `plg_my_faq_`
 * (підкреслення), і скласти його з `__PLUGIN_NAME__` у README не можна.
 * @param {string} tpl
 * @param {{ pluginName: string; coreRange: string }} vars
 */
export function renderPluginTemplate(tpl, { pluginName, coreRange }) {
  return tpl
    .replaceAll(
      '__PLUGIN_TABLE_PREFIX__',
      `plg_${pluginName.replace(/-/g, '_')}_`,
    )
    .replaceAll('__PLUGIN_NAME__', pluginName)
    .replaceAll('__CORE_RANGE__', coreRange);
}

/**
 * Людське імʼя теми з ключа: `solar-store` → `Solar Store`. Автор перепише
 * його руками в `manifest.ts`, але дефолт має бути читабельним — саме він
 * потрапляє в адмінку колонкою «Тема».
 * @param {string} themeName
 */
export function themeDisplayName(themeName) {
  return themeName
    .split('-')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Підстановка плейсхолдерів шаблону теми. `__THEME_DISPLAY_NAME__` — окремий
 * плейсхолдер, бо виводиться з імені (`themeDisplayName`), а не дорівнює йому.
 * @param {string} tpl
 * @param {{ themeName: string; displayName: string; coreRange: string }} vars
 */
export function renderThemeTemplate(
  tpl,
  { themeName, displayName, coreRange },
) {
  return tpl
    .replaceAll('__THEME_DISPLAY_NAME__', displayName)
    .replaceAll('__THEME_NAME__', themeName)
    .replaceAll('__CORE_RANGE__', coreRange);
}

/**
 * Рекурсивна копія шаблону в цільову теку з рендером КОЖНОГО файла (усі вони
 * текстові) і перейменуваннями.
 * @param {{ templateDir: string; targetDir: string;
 *   render: (source: string) => string }} input
 * @returns {string[]} відносні шляхи створених файлів
 */
export function scaffoldTree({ templateDir: from, targetDir, render }) {
  /** @type {string[]} */
  const created = [];
  const walk = (fromDir, toDir, prefix) => {
    mkdirSync(toDir, { recursive: true });
    for (const entry of readdirSync(fromDir, { withFileTypes: true })) {
      const source = join(fromDir, entry.name);
      const outName = RENAMES[entry.name] ?? entry.name;
      const target = join(toDir, outName);
      const rel = prefix ? `${prefix}/${outName}` : outName;
      if (entry.isDirectory()) walk(source, target, rel);
      else {
        writeFileSync(target, render(readFileSync(source, 'utf8')));
        created.push(rel);
      }
    }
  };
  walk(from, targetDir, '');
  return created.sort();
}

/**
 * @param {{ templateDir: string; targetDir: string; pluginName: string;
 *   coreRange: string }} input
 */
export function scaffoldPlugin({
  templateDir: from,
  targetDir,
  pluginName,
  coreRange,
}) {
  return scaffoldTree({
    templateDir: from,
    targetDir,
    render: (source) => renderPluginTemplate(source, { pluginName, coreRange }),
  });
}

/**
 * @param {{ templateDir: string; targetDir: string; themeName: string;
 *   displayName?: string; coreRange: string }} input
 */
export function scaffoldTheme({
  templateDir: from,
  targetDir,
  themeName,
  displayName = themeDisplayName(themeName),
  coreRange,
}) {
  return scaffoldTree({
    templateDir: from,
    targetDir,
    render: (source) =>
      renderThemeTemplate(source, { themeName, displayName, coreRange }),
  });
}
