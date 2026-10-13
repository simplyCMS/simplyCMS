// simplycms update [--check | --write] [--to <version>] [--no-install] —
// сценарій 2 батьківської спеки (§4.3): підняти всі пакети ядра магазину
// (`simplycms` + сателіти) на цільову версію (deps і devDeps окремо, шаблон
// пінить точні версії) і передати звірку новому CLI (Р21). Звірка теки магазину
// (host-файли, лінки скілів, файли агента) — update-reconcile.mjs.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isCorePackage, readStoreManifest, findStoreRoot } from './context.mjs';
import {
  readInstalledCoreVersion,
  resolveUpdateTarget,
} from './update-target.mjs';
import { reconcileStore } from './update-reconcile.mjs';
import { begin, finish, say } from './ui.mjs';

/** Маркер дочірнього процесу після install: новий CLI не ставить пакети вдруге (Р21). */
export const AFTER_INSTALL = '--after-install';

/**
 * `check` — чиста перевірка без мережі й install (Е8-Р12); `afterInstall` — запуск
 * новим CLI після `pnpm add` старого.
 * @param {string[]} argv
 */
export function parseUpdateArgs(argv) {
  const options = { check: false, write: false, install: true, to: undefined };
  let afterInstall = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--check') options.check = true;
    else if (arg === '--write') options.write = true;
    else if (arg === '--to') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('-'))
        throw new Error('Прапорець --to потребує значення (версію)');
      options.to = value;
      i += 1;
    } else if (arg === '--no-install') options.install = false;
    else if (arg === AFTER_INSTALL) afterInstall = true;
    else throw new Error(`Невідомий аргумент update: ${arg}`);
  }
  if (options.check && options.write)
    throw new Error('Прапорці --check і --write взаємовиключні');
  if (options.check || afterInstall) options.install = false;
  return { ...options, afterInstall };
}

/**
 * Специфікації `pnpm add` для всіх пакетів ядра манифеста — unscoped
 * `simplycms` і scoped сателітів (`isCorePackage`): deps і devDeps ОКРЕМО —
 * devDeps ставляться через `pnpm add -D`, інакше переїдуть у deps.
 * @param {{ dependencies?: Record<string, string>;
 *   devDependencies?: Record<string, string> }} manifest
 * @param {string} version
 */
export function planCoreInstall(manifest, version) {
  const pick = (source) =>
    Object.keys(source ?? {})
      .filter(isCorePackage)
      .sort()
      .map((name) => `${name}@${version}`);
  return {
    deps: pick(manifest.dependencies),
    devDeps: pick(manifest.devDependencies),
  };
}

/** Справжнє виконання дочірньої команди — дефолт ін'єкційного шва `deps.exec`. */
const defaultExec = (command, args, options) =>
  execFileSync(command, args, options);

/**
 * Поставити пакети ядра на цільову версію. `stop` — рішення не ставити (мажорна
 * межа, невідома поточна), код виходу вже виставлено; `installed` — `pnpm add` був.
 * @returns {'stop' | 'none' | 'installed'}
 */
function installCore(storeRoot, to, exec) {
  const manifest = readStoreManifest(storeRoot);
  const { version, status } = resolveUpdateTarget(to, {
    exec,
    current: readInstalledCoreVersion(storeRoot, manifest),
  });
  if (status === 'unknown' || status === 'major') {
    say.error(
      status === 'unknown'
        ? `Не вдалося визначити поточну версію ядра магазину (реєстр має ${version}). ` +
            `Вкажи цільову явно: \`simplycms update --to ${version}\``
        : `Доступна мажорна версія ${version} — містить зламані зміни, див. розділ ` +
            `BREAKING у CHANGELOG; оновлення — \`simplycms update --to ${version}\``,
    );
    process.exitCode = 3;
    finish(
      status === 'unknown'
        ? 'Поточна версія невідома — без --to не ставлю.'
        : 'Мажорну межу без --to не перетинаю.',
    );
    return 'stop';
  }
  if (status === 'up-to-date') {
    say.info(`Новішого релізу немає (у реєстрі ${version}) — пакети не чіпаю.`);
    return 'none';
  }
  const { deps: coreDeps, devDeps } = planCoreInstall(manifest, version);
  say.step(`Оновлення ядра до ${version}`);
  const add = (args) =>
    exec('pnpm', ['add', ...args], { cwd: storeRoot, stdio: 'inherit' });
  if (coreDeps.length > 0) add(coreDeps);
  if (devDeps.length > 0) add(['-D', ...devDeps]);
  return coreDeps.length + devDeps.length > 0 ? 'installed' : 'none';
}

/**
 * Р21: після `pnpm add` цей процес — СТАРИЙ CLI з каноном host/ своєї версії (Node
 * резолвить реальний шлях у `.pnpm/@simplycms+cli@<стара>`, і pnpm теку не прибирає).
 * Звірка тут дала б хибне «збігаються з каноном», тож перевірку й запис робить НОВИЙ
 * CLI магазину; маркер не дає йому ставити пакети вдруге. Код виходу — його.
 */
function handOver(storeRoot, argv, exec) {
  const cliDir = join(storeRoot, 'node_modules', '@simplycms', 'cli');
  const manifest = JSON.parse(
    readFileSync(join(cliDir, 'package.json'), 'utf8'),
  );
  // Точка входу — з `bin`, а не зашитий `src/index.mjs`: розкладка пакета може змінитись.
  const entry = join(cliDir, manifest.bin.simplycms);
  say.step('Пакети встановлено — звірку й запис веде нова версія CLI.');
  const options = { cwd: storeRoot, stdio: 'inherit' };
  try {
    exec(process.execPath, [entry, 'update', AFTER_INSTALL, ...argv], options);
  } catch (error) {
    if (typeof error?.status !== 'number') throw error;
    process.exitCode = error.status;
  }
}

/**
 * @param {string[]} argv
 * @param {{ exec?: (command: string, args: string[], options?: object) => unknown }} [deps]
 *   `exec` — єдиний шов дочірніх процесів (`pnpm view`, `pnpm add`, запуск нового
 *   CLI): тести й `--check` без мережі підставляють фейк.
 */
export async function run(argv, deps = {}) {
  const exec = deps.exec ?? defaultExec;
  const options = parseUpdateArgs(argv);
  begin('simplycms update');
  const storeRoot = findStoreRoot();
  if (options.install) {
    const installed = installCore(storeRoot, options.to, exec);
    if (installed === 'stop') return;
    if (installed === 'installed') return handOver(storeRoot, argv, exec);
  } else if (options.afterInstall) {
    say.info('Пакети поставив попередній крок — звіряю з каноном цієї версії.');
  } else if (!options.check) {
    say.info('--no-install: пакети не чіпаю, лише host-файли й файли агента.');
  }
  const exitCode = reconcileStore(storeRoot, options);
  if (exitCode !== 0) process.exitCode = exitCode;
}
