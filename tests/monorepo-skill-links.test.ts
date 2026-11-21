import { lstatSync, readdirSync, readlinkSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Скіли магазину живуть у пакеті `simplycms` (`packages/simplycms/skills/<name>`), а
// монорепо бачить їх через ПРЯМІ симлінки в обох теках агентів: ланцюжок
// `.claude/skills → .agents/skills → пакет` або копія застаріють мовчки, і агент
// монорепо читатиме не той скіл, що поїде в магазин (CLAUDE.md, «Агентний тулінг»).
const ROOT = join(import.meta.dirname, '..');
const PACKAGE_SKILLS = 'packages/simplycms/skills';
const LINK_DIRS = ['.agents/skills', '.claude/skills'];

const bundled = readdirSync(join(ROOT, PACKAGE_SKILLS), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

describe('монорепо: симлінки скілів магазину', () => {
  it('пакет постачає хоча б один скіл', () => {
    expect(bundled.length).toBeGreaterThan(0);
  });

  for (const dir of LINK_DIRS) {
    it(`${dir}: кожен скіл пакета — прямий симлінк у пакет`, () => {
      for (const name of bundled) {
        const link = join(ROOT, dir, name);
        expect(lstatSync(link).isSymbolicLink(), link).toBe(true);
        expect(readlinkSync(link), link).toBe(
          `../../${PACKAGE_SKILLS}/${name}`,
        );
      }
    });

    it(`${dir}: немає записів поза скілами пакета`, () => {
      const entries = readdirSync(join(ROOT, dir)).sort();
      expect(entries).toEqual(bundled);
    });
  }
});
