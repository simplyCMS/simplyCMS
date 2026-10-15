import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Маніфест видалених файлів канону (`migrations/removed.json`) читає CLI з
 * УСТАНОВЛЕНОГО ядра (`node_modules/simplycms/migrations`). Не потрапить у
 * tarball — `db:diff --write` мовчки перестане прибирати застарілі файли, а
 * жоден тест у монорепо цього не побачить. Склад — `npm pack --dry-run --json`
 * (те саме, що `pnpm pack` пакує за `files`). Packaging-suite: `simplycms`
 * пакує `dist`, тож потрібен `pnpm build:packages`.
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

describe('маніфест видалених файлів канону в tarball-ах', () => {
  it('tarball simplycms везе migrations/removed.json', () => {
    expect(filesOf('packages/simplycms')).toContain('migrations/removed.json');
  });

  it('tarball скаффолдера не кладе removed.json у db/migrations магазину', () => {
    const files = filesOf('packages/create-simplycms-store');
    // Позитивний контроль: міграції в tarball-і скаффолдера є, інакше «немає
    // removed.json» нічого б не доводило.
    expect(files).toContain('template/db/migrations/0001_init.sql');
    expect(files).not.toContain('template/db/migrations/removed.json');
  });
});
