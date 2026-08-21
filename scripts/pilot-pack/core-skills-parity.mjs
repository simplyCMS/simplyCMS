/**
 * Парність теки `skills/` між репозиторієм і tarball-ом пакета `simplycms`.
 *
 * Окремий модуль, бо це твердження про ІНШИЙ пакет: решта кроків Gate CLI
 * дивиться на артефакт скаффолдера, а цей — на артефакт ядра, з якого
 * магазин зрештою і читає скіли за симлінками.
 */

import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CORE_PKG_DIR = join(REPO_ROOT, 'packages/simplycms');
const PACKED_PREFIX = 'package/skills/';

/**
 * (г) Tarball `simplycms` несе ТОЧНУ множину файлів `skills/`.
 *
 * 🔴 Саме рівність множин, а не «кілька grep-ів»: npm пакує теку за
 * `files`-глобою, і мовчазна втрата окремих файлів (типовий кандидат —
 * dot-імена) дала б магазину скіл-каліку, який виглядає встановленим. Обидві
 * сторони рівності беруться з диска й з артефакту, тож дрейф ловиться в
 * обидва боки — і зайвий файл у tarball теж.
 */
export function checkPackagedSkills(work) {
  const dest = join(work, 'simplycms-core.tgz');
  execFileSync('pnpm', ['--dir', CORE_PKG_DIR, 'pack', '--out', dest], {
    cwd: REPO_ROOT,
    stdio: 'pipe',
  });
  const packed = execFileSync('tar', ['-tzf', dest], { encoding: 'utf8' })
    .split('\n')
    .filter((entry) => entry.startsWith(PACKED_PREFIX))
    .filter((entry) => !entry.endsWith('/'))
    .map((entry) => entry.slice(PACKED_PREFIX.length))
    .sort();
  const skillsDir = join(CORE_PKG_DIR, 'skills');
  const disk = readdirSync(skillsDir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(skillsDir, join(entry.parentPath, entry.name)))
    .sort();

  const missing = disk.filter((file) => !packed.includes(file));
  const extra = packed.filter((file) => !disk.includes(file));
  if (missing.length > 0 || extra.length > 0) {
    return {
      ok: false,
      details: [
        `✗ skills/ у tarball: ${packed.length}, на диску: ${disk.length}`,
        ...(missing.length ? [`  не спаковано: ${missing.join(', ')}`] : []),
        ...(extra.length ? [`  зайве в tarball: ${extra.join(', ')}`] : []),
      ],
    };
  }
  return {
    ok: true,
    details: [
      `✓ skills/ у tarball simplycms: ${packed.length} файлів — ` +
        'множина збігається з packages/simplycms/skills',
    ],
  };
}
