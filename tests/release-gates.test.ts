import { describe, expect, it } from 'vitest';
import { GATES } from '../scripts/release/gates.mjs';

// Точний склад і порядок гейтів релізу — контракт, не деталь: CLAUDE.md і
// release-process.md його цитують, а pilot:pack (трек T) мусить іти ПІСЛЯ
// test:packaging — він пакує ті самі tarball-и.
describe('гейти релізу', () => {
  it('склад і порядок рівно такі, як задокументовано', () => {
    expect(GATES.map((gate) => gate.name)).toEqual([
      'install --frozen-lockfile',
      'format:check',
      'lint',
      'build',
      'typecheck',
      'test',
      'build:packages',
      'typecheck:template',
      'test:packaging',
      'pilot:pack',
    ]);
  });
});
