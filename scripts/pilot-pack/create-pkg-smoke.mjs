/**
 * Gate CLI — смоук ОПУБЛІКОВАНОГО артефакту скаффолдера.
 *
 * Монорепо-scaffold пілота бере шаблон із теки репозиторію, тож він сліпий до
 * єдиної речі, яка ламає користувача: що саме потрапило в tarball. Тому тут
 * `pnpm pack` самого `create-simplycms-store` → розпакування в tmp → запуск
 * `bin` із розпакованого → перевірка структури згенерованого магазину. Ловить
 * втрату `template/` у `files`, зламаний `bin` і зіпсуті перейменування
 * службових імен (`gitignore` → `.gitignore` тощо).
 *
 * 🔴 Із треком К0 сюди ж додано інваріанти ДОСТАВКИ СКІЛІВ і топології 5 —
 * скіли більше не копіюються в шаблон, а приходять симлінками на теку
 * `skills/` пакета `simplycms`. Самі твердження — `create-pkg-checks.mjs`
 * (артефакт скаффолдера) і `core-skills-parity.mjs` (артефакт ядра).
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
import { checkPackagedSkills } from './core-skills-parity.mjs';
import {
  checkNoSkillCopies,
  checkSkillLinks,
  checkStoreStructure,
  checkTemplateDeps,
} from './create-pkg-checks.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI_PKG_DIR = join(REPO_ROOT, 'packages/create-simplycms-store');

/** Рантайм-залежності, без яких `bin` падає в користувача на першому рядку. */
const EXPECTED_DEPS = ['@clack/prompts'];

/**
 * @returns {{ ok: boolean; details: string[] }}
 */
export function createPkgSmoke() {
  const details = [];
  const work = mkdtempSync(join(tmpdir(), 'create-smoke-'));
  try {
    execFileSync(
      'pnpm',
      ['--dir', CLI_PKG_DIR, 'pack', '--pack-destination', work],
      {
        cwd: REPO_ROOT,
        stdio: 'pipe',
      },
    );
    const tarball = readdirSync(work).find((file) => file.endsWith('.tgz'));
    if (!tarball) return { ok: false, details: ['✗ tarball не створився'] };
    details.push(`✓ tarball: ${tarball}`);

    execFileSync('tar', ['-xzf', join(work, tarball), '-C', work], {
      stdio: 'pipe',
    });
    const pkgDir = join(work, 'package');
    if (!existsSync(join(pkgDir, 'template'))) {
      return {
        ok: false,
        details: [...details, '✗ у tarball немає template/'],
      };
    }
    const deps =
      JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
        .dependencies ?? {};
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
    symlinkSync(
      join(CLI_PKG_DIR, 'node_modules'),
      join(pkgDir, 'node_modules'),
      'dir',
    );

    const target = join(work, 'smoke-shop');
    execFileSync(
      'node',
      [
        join(pkgDir, 'src/index.mjs'),
        target,
        '--yes',
        '--no-install',
        '--no-git',
      ],
      { cwd: work, stdio: 'pipe' },
    );

    const structure = checkStoreStructure(target);
    details.push(...structure.details);
    if (!structure.ok) return { ok: false, details };

    // Інваріанти К0 — усі чотири мусять відпрацювати, щоб звіт показав
    // повну картину, тому результати збираються, а не рвуть прогін першим ✗.
    const checks = [
      checkNoSkillCopies(pkgDir),
      checkTemplateDeps(pkgDir),
      checkSkillLinks(target),
      checkPackagedSkills(work),
    ];
    for (const check of checks) details.push(...check.details);
    if (checks.some((check) => !check.ok)) return { ok: false, details };

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
