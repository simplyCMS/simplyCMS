import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  SYNCED_DIRS,
  SYNCED_FILES,
  TEMPLATE_DIR,
} from '../scripts/sync-create-store-template.mjs';

// Шаблон create-simplycms-store — генерат: дрейф із монорепо лагодиться
// `pnpm template:sync`, а не руками (модель tests/pilot-seed.test.ts).
const read = (p: string) => readFileSync(p, 'utf8');

/** Рекурсивний перелік файлів теки, шляхи — відносні до неї, відсортовані. */
const listFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)))
    .sort();

describe('create-store template: парність із монорепо', () => {
  it.each(SYNCED_FILES)('host-файл %s байт-ідентичний', (file) => {
    expect(read(join(TEMPLATE_DIR, file))).toBe(read(file));
  });

  it.each(SYNCED_DIRS.map((d) => [d.from, d.to] as const))(
    'тека %s байт-ідентична',
    (from, to) => {
      const source = listFiles(from);
      expect(source.length).toBeGreaterThan(0);
      expect(listFiles(join(TEMPLATE_DIR, to))).toEqual(source);
      for (const file of source) {
        expect(read(join(TEMPLATE_DIR, to, file))).toBe(read(join(from, file)));
      }
    },
  );

  it('deps шаблону і пілот-фікстури не розійшлися', () => {
    const tpl = JSON.parse(
      read(join(TEMPLATE_DIR, 'package.json.tpl'))
        .replaceAll('__SIMPLYCMS_VERSION__', '0.0.0')
        .replaceAll('__STORE_NAME__', 'x'),
    );
    const pilot = JSON.parse(read('tests/pilot/store-template/package.json'));
    expect(Object.keys(tpl.dependencies).sort()).toEqual(
      Object.keys(pilot.dependencies).sort(),
    );
    expect(Object.keys(tpl.devDependencies).sort()).toEqual(
      Object.keys(pilot.devDependencies).sort(),
    );
  });
});
