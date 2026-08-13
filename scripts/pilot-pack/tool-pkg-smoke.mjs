/**
 * Gate TOOL — смоук ОПУБЛІКОВАНОГО артефакту CLI обслуговування (`@simplycms/cli`).
 *
 * Той самий принцип, що Gate CLI (`create-pkg-smoke.mjs`): монорепо-тести
 * сліпі до єдиної речі, яка ламає користувача, — що саме потрапило в tarball.
 * Тому тут `pnpm pack` пакета → розпакування в tmp → перевірки артефакту:
 * bin-мапінг `simplycms` → `src/index.mjs`, оголошені рантайм-залежності,
 * наявність непорожньої `host/` (канон для `simplycms update` — її втрата в
 * `files` зробила б команду пустушкою), запуск `--help` з розпакованого і
 * збіг `--version` із версією манифеста.
 *
 * 🔴 `node_modules` розпакованого пакета — симлінк на теку пакета в репо: у
 * tarball залежностей немає, а `pnpm install` тут означав би похід у registry
 * заради одного `@clack/prompts`. Смоук перевіряє ВМІСТ артефакту, не його
 * інсталяцію — тому рантайм-залежності асертяться ОКРЕМО, по манифесту з
 * tarball: симлінк зробив би зелений прогін і для пакета, який у користувача
 * впав би на `Cannot find module '@clack/prompts'`.
 */

import { execFileSync } from 'node:child_process';
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

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const TOOL_PKG_DIR = join(REPO_ROOT, 'packages/cli');

/** Рантайм-залежності, без яких `bin` падає в користувача на першому рядку. */
const EXPECTED_DEPS = ['@clack/prompts'];

/**
 * @returns {{ ok: boolean; details: string[] }}
 */
export function toolPkgSmoke() {
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

    symlinkSync(
      join(TOOL_PKG_DIR, 'node_modules'),
      join(pkgDir, 'node_modules'),
      'dir',
    );

    execFileSync('node', [join(pkgDir, 'src/index.mjs'), '--help'], {
      cwd: work,
      stdio: 'pipe',
    });
    details.push('✓ node src/index.mjs --help: exit 0');

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
