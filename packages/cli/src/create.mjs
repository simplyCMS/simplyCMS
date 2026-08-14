// simplycms create plugin <name> [--dry-run] — авторський скаффолд плагіна
// (Фаза 3, Р9): тека plugins/<name> МАГАЗИНУ (аліас @plugins/* уже в шаблоні,
// dev-loop працює без лінків і build-кроку) + якірний запис у
// simplycms.config.ts тим самим insertEntry, що й add. Шаблон —
// template-plugin/ пакета CLI; плейсхолдери рендеряться на копіюванні.
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasPackage, insertEntry } from './config-edit.mjs';
import { findStoreRoot, readCliVersion } from './context.mjs';
import { begin, finish, say, showSteps } from './ui.mjs';

/** Імʼя плагіна — той самий контракт, що NAME_RE у definePlugin (plugin-sdk). */
const NAME_RE = /^[a-z][a-z0-9-]*$/;

/** Службові перейменування шаблону (той самий прийом, що в скаффолдері магазину). */
const RENAMES = { 'package.json.tpl': 'package.json' };

/** Тека шаблону плагіна в пакеті CLI. */
export const templatePluginDir = () =>
  join(dirname(fileURLToPath(import.meta.url)), '..', 'template-plugin');

/**
 * Розбір аргументів create. Перший позиційний токен — суб-команда:
 * у v1 підтримується лише `plugin` (спека §7 фіксує саме `create plugin`).
 * @param {string[]} argv
 * @returns {{ kind: 'plugin'; name: string; dryRun: boolean }}
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
  if (options.kind !== 'plugin')
    throw new Error(
      'Підтримується лише: simplycms create plugin <name> (теми — Фаза 4)',
    );
  if (!options.name)
    throw new Error('Не задано імʼя: simplycms create plugin <name>');
  if (!NAME_RE.test(options.name))
    throw new Error(
      `Невалідне імʼя плагіна «${options.name}»: очікується [a-z][a-z0-9-]*`,
    );
  return { kind: 'plugin', name: options.name, dryRun: options.dryRun };
}

/**
 * Підстановка плейсхолдерів шаблону плагіна.
 * @param {string} tpl
 * @param {{ pluginName: string; coreRange: string }} vars
 */
export function renderPluginTemplate(tpl, { pluginName, coreRange }) {
  return tpl
    .replaceAll('__PLUGIN_NAME__', pluginName)
    .replaceAll('__CORE_RANGE__', coreRange);
}

/**
 * Розгортання шаблону плагіна в цільову теку: рекурсивна копія з рендером
 * плейсхолдерів у КОЖНОМУ файлі (усі вони текстові) і перейменуваннями.
 * @param {{ templateDir: string; targetDir: string; pluginName: string;
 *   coreRange: string }} input
 * @returns {string[]} відносні шляхи створених файлів
 */
export function scaffoldPlugin({
  templateDir,
  targetDir,
  pluginName,
  coreRange,
}) {
  /** @type {string[]} */
  const created = [];
  const walk = (fromDir, toDir, prefix) => {
    mkdirSync(toDir, { recursive: true });
    for (const entry of readdirSync(fromDir, { withFileTypes: true })) {
      const from = join(fromDir, entry.name);
      const outName = RENAMES[entry.name] ?? entry.name;
      const to = join(toDir, outName);
      const rel = prefix ? `${prefix}/${outName}` : outName;
      if (entry.isDirectory()) {
        walk(from, to, rel);
      } else {
        writeFileSync(
          to,
          renderPluginTemplate(readFileSync(from, 'utf8'), {
            pluginName,
            coreRange,
          }),
        );
        created.push(rel);
      }
    }
  };
  walk(templateDir, targetDir, '');
  return created.sort();
}

/** @param {string[]} argv */
export async function run(argv) {
  const options = parseCreateArgs(argv);
  begin('simplycms create plugin');
  const storeRoot = findStoreRoot();
  const configPath = join(storeRoot, 'simplycms.config.ts');
  if (!existsSync(configPath))
    throw new Error(`Не знайдено ${configPath} — create не має куди писати`);
  const targetDir = join(storeRoot, 'plugins', options.name);
  if (existsSync(targetDir))
    throw new Error(`Тека ${targetDir} вже існує — нічого не змінено`);

  const spec = `@plugins/${options.name}`;
  const source = readFileSync(configPath, 'utf8');

  // Обидві незворотні дії рахуються ДО першого запису (принцип §3 спеки CLI):
  // відсутній якір конфігу валить команду, поки на диску ще нічого немає.
  const next = hasPackage(source, spec)
    ? null
    : insertEntry(source, { type: 'plugin', key: options.name, pkg: spec });

  // Мінімальний діапазон сумісності — поточна версія ядра (= версія CLI,
  // модель синхронна). `>=`, а не `^`: на 0.x caret фіксує мінор і зіпсував
  // би сумісність першим же релізом (див. semver-тести objects).
  const coreRange = `>=${readCliVersion()}`;

  if (options.dryRun) {
    say.info(
      `--dry-run: створилась би тека plugins/${options.name} зі скаффолдом` +
        (next
          ? `, у simplycms.config.ts додався б рядок:\n+ ${next.line}`
          : ''),
    );
    finish('Нічого не змінено (--dry-run).');
    return;
  }

  const created = scaffoldPlugin({
    templateDir: templatePluginDir(),
    targetDir,
    pluginName: options.name,
    coreRange,
  });
  say.success(
    `plugins/${options.name}: створено ${created.length} файлів (${created.join(', ')})`,
  );

  if (next) {
    writeFileSync(configPath, next.source);
    say.success(`simplycms.config.ts: додано плагін '${options.name}'.`);
  } else {
    say.info(`«${spec}» вже в simplycms.config.ts — запис не дублюється.`);
  }

  showSteps([
    'pnpm dev     # плагін підхопиться через аліас @plugins/* без build-кроку',
    `plugins/${options.name}/README.md   # що далі: слоти, міграції plg_*, adminRoutes`,
  ]);
  finish('Готово.');
}
