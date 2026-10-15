import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Відтворюваний доказ класу «живий auth-клієнт / ефекти після teardown jsdom».
 *
 * Тест бере справжній `query-client-context.test.tsx` і ганяє його КОПІЮ у
 * середовищі-форсері гонки (`race-teardown-env.ts`):
 *  - мутант (без `vi.mock` auth-клієнта, без cleanup/unmount) → unhandled
 *    «window is not defined» і exit ≠ 0 (хвиля Е8-E: 5/5);
 *  - поточний код → чисто, exit 0.
 * Мутант виводиться з поточного файлу правками з перевіркою, що правка
 * спрацювала, — тож зміна тесту не перетворить контроль на вакуум.
 *
 * Копія лежить поруч із оригіналом (відносні імпорти) і має розширення
 * `.race-copy.tsx`, яке дефолтний include не бачить; docblock jsdom у першому
 * рядку знімається, бо перебив би середовище-форсер.
 */
const ROOT = join(import.meta.dirname, '..', '..');
const DIR = 'packages/simplycms/src/core/__tests__';
const SRC = join(ROOT, DIR, 'query-client-context.test.tsx');

function run(kind: string, transform: (s: string) => string) {
  const copy = join(ROOT, DIR, `${kind}.race-copy.tsx`);
  const original = readFileSync(SRC, 'utf8');
  const lines = original.split('\n');
  lines[0] =
    '// (середовище задає tests/race-teardown/vitest.fixture.config.ts)';
  try {
    writeFileSync(copy, transform(lines.join('\n')));
    const r = spawnSync(
      join(ROOT, 'node_modules/.bin/vitest'),
      [
        'run',
        '--config',
        'tests/race-teardown/vitest.fixture.config.ts',
        `${DIR}/${kind}.race-copy.tsx`,
        'tests/race-teardown/hold.race-wait.ts',
      ],
      { cwd: ROOT, encoding: 'utf8', timeout: 100_000 },
    );
    return { out: `${r.stdout}\n${r.stderr}`, code: r.status };
  } finally {
    rmSync(copy, { force: true });
  }
}

const mutate = (s: string) => {
  const m = s
    .replace(/vi\.mock\('\.\.\/lib\/auth-client'[\s\S]*?\n\}\)\);\n/, '')
    .replace(/^afterEach\(cleanup\);$/m, '')
    .replace(/^\s*unmount\(\);$/m, '');
  // Мутація мусить справді повернути причину (живий клієнт без cleanup).
  expect(m).not.toContain("vi.mock('../lib/auth-client'");
  expect(m).not.toMatch(/^afterEach\(cleanup\);$/m);
  return m;
};

describe('форсер гонки teardown', () => {
  it('мутант (живий auth-клієнт без cleanup) → unhandled «window is not defined»', () => {
    const r = run('mutant', mutate);
    expect(r.out).toContain('window is not defined');
    expect(r.code).not.toBe(0);
  });

  it('поточний код → без unhandled, exit 0', () => {
    const r = run('current', (s) => s);
    expect(r.out).not.toContain('window is not defined');
    expect(r.out).not.toMatch(/Unhandled/i);
    expect(r.code).toBe(0);
  });
});
