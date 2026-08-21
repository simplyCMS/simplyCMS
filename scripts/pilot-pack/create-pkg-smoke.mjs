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
import { findPlaceholders } from './placeholder-scan.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI_PKG_DIR = join(REPO_ROOT, 'packages/create-simplycms-store');

/** Рантайм-залежності, без яких `bin` падає в користувача на першому рядку. */
const EXPECTED_DEPS = ['@clack/prompts'];

/** Файли, без яких згенерований магазин не є магазином. */
const EXPECTED_FILES = [
  'package.json',
  '.gitignore',
  '.env.example',
  'routes.ts',
  'vite.config.ts',
  'simplycms.config.ts',
  'src/routes/__root.tsx',
  'themes/default/index.ts',
  'supabase/config.toml',
  'supabase/templates/invite.html',
  'scripts/owner-invite.mjs',
  // 🔴 Без нього pnpm 11 обриває install (`ERR_PNPM_IGNORED_BUILDS`), а
  // `pnpm build` перезапускає install і теж падає — магазин не збереться.
  // Вміст стереже tests/create-store-cli.test.ts; тут — сам факт потрапляння
  // у tarball, бо `files` у манифесті легко звузити випадково.
  'pnpm-workspace.yaml',
  // 🔴 Скілів у шаблоні НЕМАЄ (трек К0): вони їдуть текою `skills/` пакета
  // `simplycms`, а магазин отримує симлінки від скаффолдера. Інваріанти
  // доставки скілів — окремим кроком гейта (Task 7 плану К0).
];

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

    for (const file of EXPECTED_FILES) {
      if (!existsSync(join(target, file))) {
        return { ok: false, details: [...details, `✗ відсутній ${file}`] };
      }
      details.push(`✓ ${file}`);
    }
    // Плейсхолдери шаблону мають бути підставлені, а не доїхати як є.
    if (existsSync(join(target, 'package.json.tpl'))) {
      return {
        ok: false,
        details: [...details, '✗ package.json.tpl не перейменовано'],
      };
    }
    const leftovers = findPlaceholders(target);
    if (leftovers.length > 0) {
      return {
        ok: false,
        details: [
          ...details,
          `✗ плейсхолдери не підставлено: ${leftovers.join(', ')}`,
        ],
      };
    }
    details.push('✓ плейсхолдерів __NAME__ не лишилось');
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
