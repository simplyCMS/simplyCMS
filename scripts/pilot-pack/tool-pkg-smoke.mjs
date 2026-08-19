/**
 * Gate TOOL — смоук ОПУБЛІКОВАНОГО артефакту CLI обслуговування (`@simplycms/cli`).
 *
 * Той самий принцип, що Gate CLI (`create-pkg-smoke.mjs`): монорепо-тести
 * сліпі до єдиної речі, яка ламає користувача, — що саме потрапило в tarball.
 * Тому тут `pnpm pack` пакета → розпакування в tmp → перевірки артефакту:
 * bin-мапінг `simplycms` → `src/index.mjs`, оголошені рантайм-залежності,
 * наявність непорожньої `host/` (канон для `simplycms update` — її втрата в
 * `files` зробила б команду пустушкою), запуск `--help` з розпакованого,
 * збіг `--version` із версією манифеста і `doctor` на свіжому скаффолді
 * шаблону (крок — tool-doctor-smoke.mjs, обіцянка спеки §6).
 *
 * 🔴 `node_modules` розпакованого пакета — симлінк на теку пакета в репо: у
 * tarball залежностей немає, а `pnpm install` тут означав би похід у registry
 * заради одного `@clack/prompts`. Смоук перевіряє ВМІСТ артефакту, не його
 * інсталяцію — тому рантайм-залежності асертяться ОКРЕМО, по манифесту з
 * tarball: симлінк зробив би зелений прогін і для пакета, який у користувача
 * впав би на `Cannot find module '@clack/prompts'`.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { doctorSmoke } from './tool-doctor-smoke.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const TOOL_PKG_DIR = join(REPO_ROOT, 'packages/cli');

/** Рантайм-залежності, без яких `bin` падає в користувача на першому рядку. */
const EXPECTED_DEPS = ['@clack/prompts'];

/**
 * @returns {Promise<{ ok: boolean; details: string[] }>}
 */
export async function toolPkgSmoke() {
  const details = [];
  const work = mkdtempSync(join(tmpdir(), 'tool-smoke-'));
  try {
    execFileSync(
      'pnpm',
      ['--dir', TOOL_PKG_DIR, 'pack', '--pack-destination', work],
      { cwd: REPO_ROOT, stdio: 'pipe' },
    );
    const tarball = readdirSync(work).find((file) => file.endsWith('.tgz'));
    if (!tarball) return { ok: false, details: ['✗ tarball не створився'] };
    details.push(`✓ tarball: ${tarball}`);

    execFileSync('tar', ['-xzf', join(work, tarball), '-C', work], {
      stdio: 'pipe',
    });
    const pkgDir = join(work, 'package');
    const manifest = JSON.parse(
      readFileSync(join(pkgDir, 'package.json'), 'utf8'),
    );

    // Зламаний bin-мапінг = мертвий `pnpm simplycms` у кожного користувача.
    if (manifest.bin?.simplycms !== 'src/index.mjs') {
      return {
        ok: false,
        details: [
          ...details,
          `✗ bin: очікувався simplycms → src/index.mjs, фактично ${JSON.stringify(manifest.bin)}`,
        ],
      };
    }
    details.push('✓ bin: simplycms → src/index.mjs');

    const deps = manifest.dependencies ?? {};
    for (const dep of EXPECTED_DEPS) {
      if (!deps[dep]) {
        return {
          ok: false,
          details: [
            ...details,
            `✗ ${dep} не в dependencies опублікованого пакета`,
          ],
        };
      }
      details.push(`✓ dependencies: ${dep}@${deps[dep]}`);
    }

    // host/ — тека сама собі маніфест, тож окрім наявності перевіряємо, що
    // всередині є хоч один файл: порожня тека формально «доїхала б».
    const hostDir = join(pkgDir, 'host');
    const hostFiles = existsSync(hostDir)
      ? readdirSync(hostDir, { recursive: true, withFileTypes: true }).filter(
          (entry) => entry.isFile(),
        )
      : [];
    if (hostFiles.length === 0) {
      return {
        ok: false,
        details: [...details, '✗ host/ відсутня в tarball або порожня'],
      };
    }
    details.push(`✓ host/: ${hostFiles.length} файлів`);

    // template-plugin/ — шаблон `simplycms create plugin` (Фаза 3): та сама
    // логіка, що для host/ — порожня тека формально «доїхала б».
    const templatePluginDir = join(pkgDir, 'template-plugin');
    const templatePluginFiles = existsSync(templatePluginDir)
      ? readdirSync(templatePluginDir, {
          recursive: true,
          withFileTypes: true,
        }).filter((entry) => entry.isFile())
      : [];
    if (templatePluginFiles.length === 0) {
      return {
        ok: false,
        details: [
          ...details,
          '✗ template-plugin/ відсутня в tarball або порожня',
        ],
      };
    }
    details.push(`✓ template-plugin/: ${templatePluginFiles.length} файлів`);

    // template-theme/ — шаблон `simplycms create theme` (Фаза 4, Р6): та сама
    // логіка, що для host/ і template-plugin/.
    const templateThemeDir = join(pkgDir, 'template-theme');
    const templateThemeFiles = existsSync(templateThemeDir)
      ? readdirSync(templateThemeDir, {
          recursive: true,
          withFileTypes: true,
        }).filter((entry) => entry.isFile())
      : [];
    if (templateThemeFiles.length === 0) {
      return {
        ok: false,
        details: [
          ...details,
          '✗ template-theme/ відсутня в tarball або порожня',
        ],
      };
    }
    details.push(`✓ template-theme/: ${templateThemeFiles.length} файлів`);

    symlinkSync(
      join(TOOL_PKG_DIR, 'node_modules'),
      join(pkgDir, 'node_modules'),
      'dir',
    );

    const help = execFileSync(
      'node',
      [join(pkgDir, 'src/index.mjs'), '--help'],
      { cwd: work, stdio: 'pipe' },
    ).toString();
    details.push('✓ node src/index.mjs --help: exit 0');
    // Довідка — контракт диспетчера: зникла команда означає, що модуль
    // випав із COMMANDS або з files, і смоук мусить це побачити.
    for (const command of [
      'doctor',
      'add',
      'create plugin',
      'create theme',
      'update',
      'db:diff',
      'theme:conformance',
    ]) {
      if (!help.includes(command)) {
        return {
          ok: false,
          details: [...details, `✗ --help не згадує команду «${command}»`],
        };
      }
    }
    details.push(
      '✓ --help згадує всі команди (включно з create theme і theme:conformance)',
    );

    const version = execFileSync(
      'node',
      [join(pkgDir, 'src/index.mjs'), '--version'],
      { cwd: work, stdio: 'pipe' },
    )
      .toString()
      .trim();
    if (version !== manifest.version) {
      return {
        ok: false,
        details: [
          ...details,
          `✗ --version дав «${version}», у манифесті ${manifest.version}`,
        ],
      };
    }
    details.push(`✓ --version: ${version}`);

    const doctor = await doctorSmoke(pkgDir, work, manifest.version);
    details.push(...doctor.details);
    if (!doctor.ok) return { ok: false, details };

    const conformance = conformanceSmoke(pkgDir, join(work, 'doctor-store'));
    details.push(...conformance.details);
    if (!conformance.ok) return { ok: false, details };

    rmSync(work, { recursive: true, force: true });
    return { ok: true, details };
  } catch (error) {
    // Тека лишається на диску: у ній єдиний слід того, що саме зламалось.
    return {
      ok: false,
      details: [...details, `✗ ${error.message}`, `робоча тека: ${work}`],
    };
  }
}

/**
 * Крок Gate TOOL для `theme:conformance` — канонічного каналу запуску
 * conformance-гейта тем v3 (амендмент до Р8, 2026-08-18).
 *
 * Скаффолд шаблону голий: ні node_modules, ні jsdom. Саме це тут і потрібно —
 * доводиться не зелений прогін гейта (для нього потрібен встановлений
 * магазин), а те, що команда з ОПУБЛІКОВАНОГО tarball-а доїжджає, знаходить
 * тему в конфізі й чесно падає з ТОЧНОЮ командою донавантаження, а не
 * мовчазним fallback-ом. Тека скаффолда — та сама, що в doctor-кроці.
 *
 * @param {string} pkgDir Тека розпакованого tarball-а `@simplycms/cli`.
 * @param {string} storeDir Скаффолд шаблону, створений doctor-кроком.
 * @returns {{ ok: boolean; details: string[] }}
 */
function conformanceSmoke(pkgDir, storeDir) {
  // 🔴 NODE_PATH вирізається: pnpm ставить його на `.pnpm/node_modules`
  // монорепо, і з ним `jsdom`/`vite` резолвляться навіть у голому скаффолді —
  // смоук був би зелений на брехні (у магазині користувача NODE_PATH немає).
  // Той самий прийом, що вирізання VITE_SUPABASE_* у doctor-кроці.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => name !== 'NODE_PATH'),
  );
  const run = spawnSync(
    'node',
    [join(pkgDir, 'src/index.mjs'), 'theme:conformance', 'default'],
    { cwd: storeDir, encoding: 'utf8', env },
  );
  const output = `${run.stdout ?? ''}${run.stderr ?? ''}`;
  if (run.status !== 1) {
    return {
      ok: false,
      details: [
        `✗ theme:conformance на голому скаффолді дав exit ${run.status}, ` +
          'очікувався 1 (немає jsdom)',
      ],
    };
  }
  for (const marker of ["import('@themes/default/index')", 'pnpm add -D jsdom'])
    if (!output.includes(marker))
      return {
        ok: false,
        details: [`✗ у виводі theme:conformance немає маркера «${marker}»`],
      };
  return {
    ok: true,
    details: ['✓ theme:conformance: тема з конфігу знайдена, інструкція jsdom'],
  };
}
