import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Оверлей-проба санітайзера (`scripts/pilot-pack/sanitize-probe.sql`, `apply-probe.mjs`) — лише для
 * пілота: брудна розмітка не має їхати в продуктові дані магазину. Склад tarball-ів береться з
 * `npm pack --dry-run --json` (те саме, що `pnpm pack` пакує за `files`), тож гейт реально бачить
 * опублікований артефакт, а не припущення. Не вакуумний: позитивний контроль — демо-сід у tarball-і
 * скаффолдера БУВ у списку (інакше «немає оверлею» нічого б не доводило).
 * Packaging-suite: `simplycms` пакує `dist`, тож потрібен `pnpm build:packages`.
 */
const ROOT = join(import.meta.dirname, '..');
const filesOf = (pkgDir: string): string[] => {
  const out = execFileSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: join(ROOT, pkgDir),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const [info] = JSON.parse(out.slice(out.indexOf('['))) as {
    files: { path: string }[];
  }[];
  return info!.files.map((f) => f.path);
};
const PROBE = /sanitize-probe|apply-probe/;

describe('оверлей-проба пілота не потрапляє в tarball-и', () => {
  it.each([
    'packages/create-simplycms-store',
    'packages/simplycms',
    'packages/cli',
  ])('%s', (pkgDir) => {
    const files = filesOf(pkgDir);
    expect(files.length).toBeGreaterThan(10);
    expect(files.filter((f) => PROBE.test(f))).toEqual([]);
  });

  it('позитивний контроль: демо-сід у tarball-і скаффолдера є', () => {
    expect(filesOf('packages/create-simplycms-store')).toContain(
      'template/db/migrations/demo/demo-seed.sql',
    );
  });
});
