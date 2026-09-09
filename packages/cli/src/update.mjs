// simplycms update [--check | --write] [--to <version>] [--no-install] —
// сценарій 2 батьківської спеки (§4.3): підняти всі пакети ядра магазину
// (`simplycms` + сателіти) на цільову версію (deps і devDeps окремо, шаблон
// пінить точні версії), полагодити лінки агентних скілів і догнати
// host-файли до канону з теки host/ цього пакета.
import { execFileSync } from 'node:child_process';
import { isCorePackage, readStoreManifest, findStoreRoot } from './context.mjs';
import {
  CANON_HOST_DIR,
  findHostDrift,
  writeHostFiles,
} from './host-drift.mjs';
import { syncSkillLinks } from './skill-links.mjs';
import { begin, finish, say, showSteps } from './ui.mjs';

/** @param {string[]} argv */
export function parseUpdateArgs(argv) {
  const options = { write: false, install: true, to: undefined };
  let check = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--check') check = true;
    else if (arg === '--write') options.write = true;
    else if (arg === '--to') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('-'))
        throw new Error('Прапорець --to потребує значення (версію)');
      options.to = value;
      i += 1;
    } else if (arg === '--no-install') options.install = false;
    else throw new Error(`Невідомий аргумент update: ${arg}`);
  }
  if (check && options.write)
    throw new Error('Прапорці --check і --write взаємовиключні');
  return options;
}

/** `pnpm view @simplycms/cli version` — останній опублікований реліз ядра. */
function queryRegistryVersion() {
  return execFileSync('pnpm', ['view', '@simplycms/cli', 'version'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/**
 * Цільова версія: `--to` як є; без нього — запит реєстру. Недоступний реєстр
 * чи порожня відповідь — гучне падіння з підказкою `--to`, не «остання відома».
 * @param {string | undefined} to
 * @param {() => string} [query]
 */
export function resolveTargetVersion(to, query = queryRegistryVersion) {
  if (to) return to;
  let raw;
  try {
    raw = query();
  } catch (cause) {
    throw new Error(
      'Реєстр недоступний — цільову версію не зʼясувати. ' +
        'Задай її явно: simplycms update --to <version>',
      { cause },
    );
  }
  const version = String(raw).trim();
  if (!version)
    throw new Error(
      'Реєстр не повернув версію @simplycms/cli. ' +
        'Задай її явно: simplycms update --to <version>',
    );
  return version;
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

/** Exit-код кроку host-файлів: дрейф без --write → 1 (придатне для CI). */
export const hostDriftExitCode = (drifted, write) =>
  drifted.length > 0 && !write ? 1 : 0;

/** @param {string[]} argv */
export async function run(argv) {
  const options = parseUpdateArgs(argv);
  begin('simplycms update');
  const storeRoot = findStoreRoot();
  if (options.install) {
    const version = resolveTargetVersion(options.to);
    const { deps, devDeps } = planCoreInstall(
      readStoreManifest(storeRoot),
      version,
    );
    say.step(`Оновлення ядра до ${version}`);
    const add = (args) =>
      execFileSync('pnpm', ['add', ...args], {
        cwd: storeRoot,
        stdio: 'inherit',
      });
    if (deps.length > 0) add(deps);
    if (devDeps.length > 0) add(['-D', ...devDeps]);
  } else {
    say.info('--no-install: пакети не чіпаю, лише host-файли.');
  }
  // Лінки скілів лагодяться завжди й тихо: на exit-код вони не впливають,
  // бо після цього кроку стану «є що зробити» не лишається.
  syncSkillLinks(storeRoot);
  const { files, drifted } = findHostDrift(storeRoot);
  if (files.length === 0)
    throw new Error(
      `Канонічна тека host/ пакета CLI порожня або відсутня (${CANON_HOST_DIR}) — ` +
        'інсталяція CLI бита, перевстанови @simplycms/cli',
    );
  if (drifted.length === 0) {
    say.success('Host-файли збігаються з каноном.');
    finish('Готово.');
    return;
  }
  if (options.write) {
    writeHostFiles(storeRoot, drifted);
    say.success(`Перезаписано канонічними версіями: ${drifted.join(', ')}`);
    showSteps([
      'git diff     # ревʼю перезаписаних host-файлів',
      'pnpm build   # перезбірка магазину',
    ]);
    finish('Готово.');
    return;
  }
  say.error(`Дрейф host-файлів проти канону: ${drifted.join(', ')}`);
  showSteps([
    'pnpm simplycms update --write   # перезаписати канонічними версіями',
  ]);
  process.exitCode = hostDriftExitCode(drifted, options.write);
  finish('Дрейф знайдено (--check).');
}
