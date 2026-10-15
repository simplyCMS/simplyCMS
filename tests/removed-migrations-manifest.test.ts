import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SCHEMA_MIGRATIONS_DIR } from '../scripts/sync-create-store-template.mjs';

// Маніфест файлів, прибраних з канону ядра, — ЗАКРИТИЙ перелік: CLI видаляє в
// магазині лише названий файл із точним sha256. Помилка тут або знесла б чужу
// міграцію, або лишила б застарілу (і накат упав би на CREATE TABLE вдруге).
type Entry = {
  name: string;
  sha256: string;
  removedIn: string;
  reason: string;
};

const MANIFEST = join(SCHEMA_MIGRATIONS_DIR, 'removed.json');
const manifest: Entry[] = JSON.parse(readFileSync(MANIFEST, 'utf8'));

/** Тег доступний не скрізь (CI клонує з fetch-depth 2 без тегів). */
const tagAvailable = (tag: string): boolean => {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', `${tag}^{tag}`], {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
};

describe('маніфест видалених файлів канону (removed.json)', () => {
  it('маніфест не порожній, кожен запис має 64-hex sha256 і повні поля', () => {
    expect(manifest.length).toBeGreaterThan(0);
    for (const entry of manifest) {
      expect(entry.sha256, entry.name).toMatch(/^[0-9a-f]{64}$/);
      expect(entry.name, entry.name).toMatch(/^\d{4}_[a-z0-9_]+\.sql$/);
      expect(entry.removedIn, entry.name).not.toBe('');
      expect(entry.reason, entry.name).not.toBe('');
    }
    const names = manifest.map((entry) => entry.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('жодного з імен немає в поточному каноні', () => {
    // Файл, що і в каноні, і в маніфесті, `--write` скопіював би й одразу
    // видалив би — тож таке розходження мусить червоніти ще в монорепо.
    const canon = readdirSync(SCHEMA_MIGRATIONS_DIR);
    for (const { name } of manifest) expect(canon, name).not.toContain(name);
  });

  it.skipIf(!tagAvailable('v0.15.0'))(
    'sha256 0005_mail_outbox.sql = sha256 файла з тега v0.15.0',
    () => {
      const entry = manifest.find((e) => e.name === '0005_mail_outbox.sql');
      expect(entry).toBeDefined();
      const released = execFileSync(
        'git',
        ['show', 'v0.15.0:packages/simplycms/migrations/0005_mail_outbox.sql'],
        { encoding: 'buffer' },
      );
      expect(entry?.sha256).toBe(
        createHash('sha256').update(released).digest('hex'),
      );
    },
  );

  // Тег у CI відсутній (fetch-depth 2), тож без цього гарда правка хеша там
  // не червоніла б: значення зафіксовано літералом, узятим із тега v0.15.0.
  it('sha256 0005_mail_outbox.sql збігається із зафіксованим значенням v0.15.0', () => {
    expect(
      manifest.find((e) => e.name === '0005_mail_outbox.sql')?.sha256,
    ).toBe('fc5b714b963732218da7b39a4808ab87067dadf62c27b2ac6d039bb26346bb95');
  });

  it('канон ядра дійсно не містить 0005_mail_outbox.sql', () => {
    expect(
      existsSync(join(SCHEMA_MIGRATIONS_DIR, '0005_mail_outbox.sql')),
    ).toBe(false);
  });
});
