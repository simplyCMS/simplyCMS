import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Р31: гейти (`test`, `test:schema`) не читають `.env*` розробника. Проба біжить
// справжнім конфігом на ТИМЧАСОВОМУ корені з `.env.local` (VITE_SITE_URL=leak.test),
// щоб не чіпати файли власника в корені дерева. `--globals`: проба без імпортів,
// бо з tmp-теки `vitest` не резолвиться.
const REPO = resolve(import.meta.dirname, '..');
const VITEST = join(REPO, 'node_modules/.bin/vitest');

function probe(expected: string) {
  return `test('VITE_SITE_URL гейта', () => {
  expect(process.env.VITE_SITE_URL).toBe(${JSON.stringify(expected)});
  expect(process.env.VITE_GATE_LEAK).toBeUndefined();
  expect(import.meta.env.VITE_SITE_URL).toBe(${JSON.stringify(expected)});
});
`;
}

describe('гейти ізольовані від .env* розробника', () => {
  let root: string;
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'gate-env-'));
    writeFileSync(
      join(root, '.env.local'),
      'VITE_SITE_URL=http://leak.test\nVITE_GATE_LEAK=1\n',
    );
    const put = (rel: string, body: string) => {
      const f = join(root, rel);
      mkdirSync(dirname(f), { recursive: true });
      writeFileSync(f, body);
    };
    // `unit`: звичайний гейт — з `.env.local` значення не приходить взагалі.
    put(
      'probe-unit.test.ts',
      probe('undefined').replace(/"undefined"/g, 'undefined'),
    );
    // `pg`: фіксоване тестове значення з test.env проєкту.
    put(
      'packages/simplycms/test-harness/pg/__tests__/probe.test.ts',
      probe('http://store.test'),
    );
  });
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  function run(config: string, extra: string[]) {
    const env = { ...process.env };
    delete env.VITE_SITE_URL;
    return spawnSync(
      VITEST,
      [
        'run',
        '--config',
        join(REPO, config),
        '--root',
        root,
        '--globals',
        ...extra,
      ],
      { env, encoding: 'utf8', timeout: 120_000 },
    );
  }

  it('vitest.config.ts: VITE_SITE_URL з .env.local не потрапляє в тести', () => {
    const r = run('vitest.config.ts', ['probe-unit']);
    expect(r.stdout + r.stderr).toMatch(/1 passed/);
    expect(r.status).toBe(0);
  }, 130_000);

  it('vitest.schema.config.ts, проєкт pg: VITE_SITE_URL = фіксоване, не leak.test', () => {
    const r = run('vitest.schema.config.ts', ['--project', 'pg']);
    expect(r.stdout + r.stderr).toMatch(/1 passed/);
    expect(r.status).toBe(0);
  }, 130_000);
});
