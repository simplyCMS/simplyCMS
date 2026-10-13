// simplycms update [--check | --write] [--to <version>] [--no-install] —
// сценарій 2 батьківської спеки (§4.3): підняти всі пакети ядра магазину
// (`simplycms` + сателіти) на цільову версію (deps і devDeps окремо, шаблон
// пінить точні версії), полагодити лінки агентних скілів і догнати
// host-файли до канону з теки host/ цього пакета.
import { execFileSync } from 'node:child_process';
import { missingStoreMigrationsDir } from './db-diff.mjs';
import { isCorePackage, readStoreManifest, findStoreRoot } from './context.mjs';
import {
  CANON_HOST_DIR,
  findHostDrift,
  writeHostFiles,
} from './host-drift.mjs';
import { pgUpdateHint } from './pg-peer.mjs';
import {
  readInstalledCoreVersion,
  resolveUpdateTarget,
} from './update-target.mjs';
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

/** Справжнє виконання дочірньої команди — дефолт ін'єкційного шва `deps.exec`. */
const defaultExec = (command, args, options) =>
  execFileSync(command, args, options);

/**
 * @param {string[]} argv
 * @param {{ exec?: (command: string, args: string[], options?: object) => unknown }} [deps]
 *   `exec` — єдиний шов для `pnpm view` і `pnpm add`: тести й `--check` без
 *   мережі підставляють фейк.
 */
export async function run(argv, deps = {}) {
  const exec = deps.exec ?? defaultExec;
  const options = parseUpdateArgs(argv);
  begin('simplycms update');
  const storeRoot = findStoreRoot();
  if (options.install) {
    const manifest = readStoreManifest(storeRoot);
    const { version, status } = resolveUpdateTarget(options.to, {
      exec,
      current: readInstalledCoreVersion(storeRoot, manifest),
    });
    if (status === 'unknown') {
      say.error(
        `Не вдалося визначити поточну версію ядра магазину (реєстр має ${version}). ` +
          `Вкажи цільову явно: \`simplycms update --to ${version}\``,
      );
      process.exitCode = 3;
      finish('Поточна версія невідома — без --to не ставлю.');
      return;
    }
    if (status === 'major') {
      say.error(
        `Доступна мажорна версія ${version} — містить зламані зміни, див. розділ ` +
          `BREAKING у CHANGELOG; оновлення — \`simplycms update --to ${version}\``,
      );
      process.exitCode = 3;
      finish('Мажорну межу без --to не перетинаю.');
      return;
    }
    if (status === 'up-to-date') {
      say.info(
        `Новішого релізу немає (у реєстрі ${version}) — пакети не чіпаю.`,
      );
    } else {
      const { deps: coreDeps, devDeps } = planCoreInstall(manifest, version);
      say.step(`Оновлення ядра до ${version}`);
      const add = (args) =>
        exec('pnpm', ['add', ...args], { cwd: storeRoot, stdio: 'inherit' });
      if (coreDeps.length > 0) add(coreDeps);
      if (devDeps.length > 0) add(['-D', ...devDeps]);
    }
  } else {
    say.info('--no-install: пакети не чіпаю, лише host-файли.');
  }
  // Драйвер `pg` належить магазину: update його не переписує, лише підказує, якщо новий peer
  // ядра розійшовся з тим, що стоїть у магазині.
  const pgHint = pgUpdateHint(storeRoot, readStoreManifest(storeRoot));
  if (pgHint) say.warn(pgHint);
  // Лінки скілів лагодяться завжди й тихо: на exit-код вони не впливають,
  // бо після цього кроку стану «є що зробити» не лишається.
  syncSkillLinks(storeRoot);
  const { files, drifted } = findHostDrift(storeRoot);
  if (files.length === 0)
    throw new Error(
      `Канонічна тека host/ пакета CLI порожня або відсутня (${CANON_HOST_DIR}) — ` +
        'інсталяція CLI бита, перевстанови @simplycms/cli',
    );
  // Одна точка виходу: усі гілки host-дрейфу (немає / --write / --check)
  // сходяться в перевірку теки міграцій, щоб жодна не мовчала про неї. Host-
  // синк при цьому відпрацьовує повністю — відсутня тека не кидає виняток.
  let exitCode = 0;
  let summary = 'Готово.';
  if (drifted.length === 0) {
    say.success('Host-файли збігаються з каноном.');
  } else if (options.write) {
    writeHostFiles(storeRoot, drifted);
    say.success(`Перезаписано канонічними версіями: ${drifted.join(', ')}`);
    showSteps([
      'git diff     # ревʼю перезаписаних host-файлів',
      'pnpm build   # перезбірка магазину',
    ]);
  } else {
    say.error(`Дрейф host-файлів проти канону: ${drifted.join(', ')}`);
    showSteps([
      'pnpm simplycms update --write   # перезаписати канонічними версіями',
    ]);
    exitCode = hostDriftExitCode(drifted, options.write);
    summary = 'Дрейф знайдено (--check).';
  }
  const missingMigrations = missingStoreMigrationsDir(storeRoot);
  if (missingMigrations) {
    say.error(missingMigrations);
    exitCode = Math.max(exitCode, 1);
    summary = 'Тека міграцій магазину відсутня.';
  }
  if (exitCode !== 0) process.exitCode = exitCode;
  finish(summary);
}
