// simplycms create (plugin | theme) <name> [--dry-run] — авторський скаффолд
// у самому МАГАЗИНІ: тека `plugins/<name>` (Фаза 3, Р9) або `themes/<name>`
// (Фаза 4, Р6) + якірний запис у simplycms.config.ts тим самим insertEntry,
// що й add. Аліаси `@plugins/*` і `@themes/*` уже в шаблоні, тож dev-loop
// працює без лінків і build-кроку. Шаблони — template-plugin/ і
// template-theme/ пакета CLI; плейсхолдери рендеряться на копіюванні.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { hasPackage, insertEntry } from './config-edit.mjs';
import { findScaffoldRoot, readCliVersion } from './context.mjs';
import {
  scaffoldPlugin,
  scaffoldTheme,
  templatePluginDir,
  templateThemeDir,
} from './create-scaffold.mjs';
import { begin, finish, say, showSteps } from './ui.mjs';

export {
  renderPluginTemplate,
  renderThemeTemplate,
  scaffoldPlugin,
  scaffoldTheme,
  templatePluginDir,
  templateThemeDir,
  themeDisplayName,
} from './create-scaffold.mjs';

/** Імʼя — той самий контракт, що NAME_RE у definePlugin (plugin-sdk). */
const NAME_RE = /^[a-z][a-z0-9-]*$/;

/** Що саме скаффолдиться: тека магазину + специфікатор запису в конфізі. */
const KINDS = {
  plugin: { dir: 'plugins', spec: (name) => `@plugins/${name}` },
  theme: { dir: 'themes', spec: (name) => `@themes/${name}/index` },
};

/**
 * Розбір аргументів create. Перший позиційний токен — суб-команда
 * (`plugin` — спека §7; `theme` — Фаза 4).
 * @param {string[]} argv
 * @returns {{ kind: 'plugin' | 'theme'; name: string; dryRun: boolean }}
 */
export function parseCreateArgs(argv) {
  /** @type {{ kind?: string; name?: string; dryRun: boolean }} */
  const options = { dryRun: false };
  for (const arg of argv) {
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg.startsWith('-'))
      throw new Error(`Невідомий прапорець create: ${arg}`);
    else if (!options.kind) options.kind = arg;
    else if (!options.name) options.name = arg;
    else throw new Error(`Зайвий аргумент: ${arg}`);
  }
  if (options.kind !== 'plugin' && options.kind !== 'theme')
    throw new Error(
      'Підтримується лише: simplycms create (plugin | theme) <name>',
    );
  if (!options.name)
    throw new Error(`Не задано імʼя: simplycms create ${options.kind} <name>`);
  if (!NAME_RE.test(options.name))
    throw new Error(
      `Невалідне імʼя «${options.name}»: очікується [a-z][a-z0-9-]*`,
    );
  return { kind: options.kind, name: options.name, dryRun: options.dryRun };
}

/** Наступні кроки — різні для плагіна й теми (тему ще треба активувати). */
function nextSteps(kind, name) {
  if (kind === 'plugin')
    return [
      'pnpm dev     # плагін підхопиться через аліас @plugins/* без build-кроку',
      `plugins/${name}/README.md   # що далі: слоти, міграції plg_*, adminRoutes`,
    ];
  return [
    'pnpm dev     # тема підхопиться через аліас @themes/* без build-кроку',
    '/admin/themes   # активуй тему в адмінці (рядок заводить bootstrapThemes)',
    // Гейт контракту v3 має бути ВИДИМИЙ з коробки — навіть у магазині без
    // тестового рушія (амендмент до Р8): CLI-канал працює завжди.
    `pnpm simplycms theme:conformance ${name}   # гейт views (потребує jsdom)`,
    `themes/${name}/README.md   # що далі: токени, views, публікація`,
  ];
}

/** @param {string[]} argv */
export async function run(argv) {
  const { kind, name, dryRun } = parseCreateArgs(argv);
  begin(`simplycms create ${kind}`);
  // Єдина команда, якій корінь монорепо ядра теж підходить (Р9): див.
  // findScaffoldRoot у context.mjs.
  const storeRoot = findScaffoldRoot();
  const configPath = join(storeRoot, 'simplycms.config.ts');
  if (!existsSync(configPath))
    throw new Error(`Не знайдено ${configPath} — create не має куди писати`);
  const { dir, spec: toSpec } = KINDS[kind];
  const targetDir = join(storeRoot, dir, name);
  if (existsSync(targetDir))
    throw new Error(`Тека ${targetDir} вже існує — нічого не змінено`);

  const spec = toSpec(name);
  const source = readFileSync(configPath, 'utf8');

  // Обидві незворотні дії рахуються ДО першого запису (принцип §3 спеки CLI):
  // відсутній якір конфігу валить команду, поки на диску ще нічого немає.
  const next = hasPackage(source, spec)
    ? null
    : insertEntry(source, { type: kind, key: name, pkg: spec });

  // Мінімальний діапазон сумісності — поточна версія ядра (= версія CLI,
  // модель синхронна). `>=`, а не `^`: на 0.x caret фіксує мінор і зіпсував
  // би сумісність першим же релізом (див. semver-тести objects).
  const coreRange = `>=${readCliVersion()}`;

  if (dryRun) {
    say.info(
      `--dry-run: створилась би тека ${dir}/${name} зі скаффолдом` +
        (next
          ? `, у simplycms.config.ts додався б рядок:\n+ ${next.line}`
          : ''),
    );
    finish('Нічого не змінено (--dry-run).');
    return;
  }

  const created =
    kind === 'plugin'
      ? scaffoldPlugin({
          templateDir: templatePluginDir(),
          targetDir,
          pluginName: name,
          coreRange,
        })
      : scaffoldTheme({
          templateDir: templateThemeDir(),
          targetDir,
          themeName: name,
          coreRange,
        });
  say.success(
    `${dir}/${name}: створено ${created.length} файлів (${created.join(', ')})`,
  );

  if (next) {
    writeFileSync(configPath, next.source);
    const label = kind === 'plugin' ? 'плагін' : 'тему';
    say.success(`simplycms.config.ts: додано ${label} '${name}'.`);
  } else {
    say.info(`«${spec}» вже в simplycms.config.ts — запис не дублюється.`);
  }

  showSteps(nextSteps(kind, name));
  finish('Готово.');
}
