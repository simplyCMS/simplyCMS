import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GATES } from '../scripts/release/gates.mjs';

// Точний склад і порядок гейтів релізу — контракт, не деталь: CLAUDE.md і
// release-process.md його цитують, а pilot (трек T, з К3-Е7 — повний, із Gate B) мусить іти ПІСЛЯ
// test:packaging — він пакує ті самі tarball-и.
describe('гейти релізу', () => {
  it('склад і порядок рівно такі, як задокументовано', () => {
    expect(GATES.map((gate) => gate.name)).toEqual([
      'install --frozen-lockfile',
      'format:check',
      'lint',
      'build',
      'typecheck',
      'typecheck:showcase',
      'test',
      'build:packages',
      'typecheck:template',
      'test:packaging',
      'schema',
      'pilot',
    ]);
  });

  // `test:schema` у релізі (1.0): повним харнесом, а не голим vitest — проєкти
  // storage і mail без Garage/Mailpit не стартують.
  it('гейт schema — test:schema після harness:up', () => {
    const gate = GATES.find((g) => g.name === 'schema');
    expect(gate?.cmd).toBe('node scripts/release/schema-full.mjs');
    const script = readFileSync('scripts/release/schema-full.mjs', 'utf8');
    expect(script).toContain('pnpm harness:up');
    expect(script).toContain("run('pnpm test:schema')");
  });

  // Реліз ганяє ПОВНИЙ пілот із Gate B (К3-Е7, Task 11): `pilot:pack` без БД не піднімає
  // сервер скретча, і «бандл не стартує» проходило непоміченим 0.7.0–0.13.0.
  it('гейт pilot — повний pnpm pilot проти харнеса, а не pilot:pack', () => {
    const gate = GATES.find((g) => g.name === 'pilot');
    expect(gate?.cmd).toBe('node scripts/release/pilot-full.mjs');
    const script = readFileSync('scripts/release/pilot-full.mjs', 'utf8');
    expect(script).toContain('pnpm harness:up');
    expect(script).toContain('pnpm db:demo');
    expect(script).toContain("run('pnpm pilot'");
    // Garage і Mailpit харнесу доходять до пілота: без них gate-media/gate-mail — skip.
    expect(script).toContain('PILOT_S3_');
    expect(script).toContain('PILOT_SMTP_URL');
    expect(script).toContain('PILOT_MAIL_FROM');
    expect(script).toContain('PILOT_MAILPIT_URL');
    expect(script).not.toContain('--pack-only');
    expect(script).not.toContain('pilot:pack');
    expect(GATES.some((g) => g.cmd.includes('pilot:pack'))).toBe(false);
  });
});
