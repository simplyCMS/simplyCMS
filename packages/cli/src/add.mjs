// simplycms add <pkg> (--plugin | --theme): build-time-встановлення зі спеки
// §4.2 — pnpm add → якірний запис у simplycms.config.ts → нагадування про
// rebuild. Тип обовʼязковий: автодетекції у v1 немає (вгадування —
// мовчазний запасний варіант, §3).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deriveKey, hasPackage, insertEntry } from './config-edit.mjs';
import { findStoreRoot } from './context.mjs';
import { begin, finish, say, showSteps } from './ui.mjs';

/**
 * Розбір аргументів add. Порушення контракту прапорців — гучна помилка.
 * @param {string[]} argv
 * @returns {{ pkg: string; type: 'plugin' | 'theme'; name?: string;
 *   install: boolean; dryRun: boolean }}
 */
export function parseAddArgs(argv) {
  /** @type {{ pkg?: string; type?: 'plugin' | 'theme'; name?: string;
   *   install: boolean; dryRun: boolean }} */
  const options = { install: true, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--plugin' || arg === '--theme') {
      const type = arg === '--plugin' ? 'plugin' : 'theme';
      if (options.type && options.type !== type)
        throw new Error('Прапорці --plugin і --theme взаємовиключні');
      options.type = type;
    } else if (arg === '--name') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('-'))
        throw new Error('Прапорець --name потребує значення');
      options.name = value;
      i += 1;
    } else if (arg === '--no-install') options.install = false;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg.startsWith('-'))
      throw new Error(`Невідомий прапорець add: ${arg}`);
    else if (options.pkg) throw new Error(`Зайвий аргумент: ${arg}`);
    else options.pkg = arg;
  }
  if (!options.pkg)
    throw new Error(
      'Не задано пакет: simplycms add <pkg> (--plugin | --theme)',
    );
  if (!options.type)
    throw new Error(
      'Задай тип явно: --plugin або --theme (автодетекції у v1 немає)',
    );
  return { ...options, pkg: options.pkg, type: options.type };
}

/** @param {string[]} argv */
export async function run(argv) {
  const options = parseAddArgs(argv);
  begin('simplycms add');
  const storeRoot = findStoreRoot();
  const configPath = join(storeRoot, 'simplycms.config.ts');
  if (!existsSync(configPath))
    throw new Error(`Не знайдено ${configPath} — add не має куди писати`);
  const source = readFileSync(configPath, 'utf8');
  const key = deriveKey(options.pkg, options.name);

  // Ідемпотентність — не fallback: повторний запуск без роботи = успіх (§3).
  if (hasPackage(source, options.pkg)) {
    say.success(`«${options.pkg}» вже в simplycms.config.ts — нічого робити.`);
    finish('Вже зроблено.');
    return;
  }

  // Вставка рахується ДО install: відсутній якір валить команду, поки
  // нічого не змінено — ні конфіг, ні node_modules.
  const next = insertEntry(source, {
    type: options.type,
    key,
    pkg: options.pkg,
  });
  if (options.dryRun) {
    say.info(
      `--dry-run: у simplycms.config.ts додався б рядок (після якоря):\n+ ${next.line}`,
    );
    finish('Нічого не змінено (--dry-run).');
    return;
  }

  if (options.install) {
    say.step(`pnpm add ${options.pkg}`);
    // Помилка install летить нагору як є: конфіг ще не змінено.
    execFileSync('pnpm', ['add', options.pkg], {
      cwd: storeRoot,
      stdio: 'inherit',
    });
  }
  writeFileSync(configPath, next.source);
  const kind = options.type === 'plugin' ? 'плагін' : 'тему';
  say.success(`simplycms.config.ts: додано ${kind} '${key}'.`);

  const steps = [
    'pnpm build   # конфіг — build-time, без rebuild змін не буде',
  ];
  if (options.type === 'plugin')
    steps.push(
      'міграції плагіна (якщо є) — вручну за README плагіна; конвеєр приїде з Plugin SDK (Фаза 3)',
    );
  showSteps(steps);
  finish('Готово.');
}
