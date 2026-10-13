import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  extractBlockIntro,
  renderManagedBlock,
} from '../packages/cli/src/managed-block.mjs';
import { renderHookState } from '../packages/cli/src/status-render.mjs';
import { collectStatus } from '../packages/cli/src/status.mjs';
import {
  deriveStage,
  nextSkill,
  statusExitCode,
} from '../packages/cli/src/status-stage.mjs';
import { CLI_INDEX, STORE_ENV, scaffoldFakeStore } from './lib/fake-core-store';

// `simplycms status` (Б §3.1, Task 19): етап, наступний скіл, коди 0/3/невідомо.
const INTRO = readFileSync('packages/simplycms/agent/intro.md', 'utf8');
const roots: string[] = [];
afterAll(() => {
  for (const dir of roots) rmSync(dir, { recursive: true, force: true });
});

const store = (name: string) => scaffoldFakeStore(name, roots);
const DEPLOY_RECORD = {
  version: 1,
  dokploy: {
    url: 'https://dokploy.example.com',
    projectId: 'p',
    applicationId: 'a',
    postgresId: 'pg',
  },
  // `.invalid` (RFC 6761) не резолвиться: тест етапу не ходить у справжню мережу.
  domain: 'shop.invalid',
  bucket: 'shop-media',
  createdAt: '2026-10-13T10:00:00.000Z',
};

function status(cwd: string, ...args: string[]) {
  const r = spawnSync('node', [CLI_INDEX, 'status', ...args], {
    cwd,
    env: { ...process.env, ...STORE_ENV, NODE_ENV: '' },
    encoding: 'utf8',
  });
  return { out: r.stdout, err: r.stderr, code: r.status };
}

const ok = { id: 'x', title: 'x', status: 'ok' } as const;
const bad = { id: 'env', title: 'env', status: 'error' } as const;

describe('чисті функції етапу', () => {
  it('deriveStage: немає магазину → not-created; є без deploy.json → local; з ним → deployed', () => {
    expect(deriveStage({ hasStoreRoot: false, deployJson: null })).toBe(
      'not-created',
    );
    expect(deriveStage({ hasStoreRoot: true, deployJson: null })).toBe('local');
    expect(deriveStage({ hasStoreRoot: true, deployJson: {} })).toBe(
      'deployed',
    );
  });

  const warn = { id: 'w', title: 'w', status: 'warn' } as const;
  // Рядки таблиці `nextSkill` з docs/architecture/cli.md (розділ status), кожен окремо.
  it.each([
    ['1: not-created без перевірок', 'not-created', [], 'simplycms-onboarding'],
    [
      '1: not-created навіть з error',
      'not-created',
      [bad],
      'simplycms-onboarding',
    ],
    ['2: local з error', 'local', [bad], 'simplycms-diagnose'],
    ['2: deployed з error', 'deployed', [ok, bad], 'simplycms-diagnose'],
    ['3: local лише ok', 'local', [ok], 'simplycms-onboarding'],
    ['3: local лише з warn', 'local', [warn], 'simplycms-onboarding'],
    ['4: deployed лише ok', 'deployed', [ok], null],
    ['4: deployed лише з warn', 'deployed', [warn], null],
  ])('nextSkill, рядок %s', (_n, stage, checks, skill) => {
    expect(nextSkill({ stage, checks } as never)?.skill ?? null).toBe(skill);
  });

  it('statusExitCode: гаразд 0, є що робити 3, unknown — ні 0, ні 3', () => {
    const base = { stage: 'deployed', checks: [ok], next: null, unknown: [] };
    expect(statusExitCode(base)).toBe(0);
    expect(statusExitCode({ ...base, next: { skill: 's', reason: 'r' } })).toBe(
      3,
    );
    const unknown = statusExitCode({ ...base, unknown: ['env: збій'] });
    expect([0, 3]).not.toContain(unknown);
    // unknown важить більше за «є що робити»: невідомий стан не прикидається планом дій.
    expect(
      statusExitCode({
        ...base,
        next: { skill: 's', reason: 'r' },
        unknown: ['env: збій'],
      }),
    ).toBe(unknown);
  });
});

describe('collectStatus', () => {
  it('перевірка, що кидає, потрапляє в unknown, а решта працює', async () => {
    const root = await store('st-throw');
    const report = await collectStatus(root, {
      online: () => [],
      checks: [
        {
          label: 'boom',
          run: () => {
            throw new Error('збій диска');
          },
        },
        {
          label: 'fine',
          run: () => ({ id: 'fine', title: 'Ок', status: 'ok' }),
        },
      ],
    });
    expect(report.unknown).toHaveLength(1);
    expect(report.unknown[0]).toContain('boom');
    expect(report.unknown[0]).toContain('збій диска');
    expect(report.checks.map((c: { id: string }) => c.id)).toEqual(['fine']);
    expect([0, 3]).not.toContain(statusExitCode(report));
  });

  it('повільна перевірка (10 с): вся команда <6 с, запис у unknown', async () => {
    const root = await store('st-slow');
    const started = Date.now();
    const report = await collectStatus(root, {
      online: () => [],
      checks: [
        {
          label: 'slow',
          // Асинхронна перевірка, що не вкладається: повертає не Check, а проміс.
          run: (() =>
            new Promise((resolve) =>
              (
                setTimeout(resolve, 10_000) as unknown as { unref(): void }
              ).unref(),
            )) as never,
        },
        {
          label: 'fine',
          run: () => ({ id: 'fine', title: 'Ок', status: 'ok' }),
        },
      ],
    });
    expect(Date.now() - started).toBeLessThan(6000);
    expect(report.unknown).toHaveLength(1);
    expect(report.unknown[0]).toContain('slow');
    expect(report.checks).toHaveLength(1);
  }, 15_000);
});

describe('таймаут контексту й обрізання --hook', () => {
  it('повільний контекст (10 с): <6 с, запис у unknown, код 1', async () => {
    const root = await store('st-slow-ctx');
    const started = Date.now();
    const report = await collectStatus(root, {
      buildContext: (() =>
        new Promise((resolve) =>
          (setTimeout(resolve, 10_000) as unknown as { unref(): void }).unref(),
        )) as never,
    });
    expect(Date.now() - started).toBeLessThan(6000);
    expect(report.unknown).toHaveLength(1);
    expect(report.unknown[0]).toContain('контекст перевірок');
    expect(report.checks).toEqual([]);
    expect(statusExitCode(report)).toBe(1);
  }, 15_000);

  it('≥30 проблем: стан ≤25 рядків, а unknown не зрізається', () => {
    const checks = Array.from({ length: 30 }, (_, i) => ({
      id: `c${i}`,
      title: `проблема ${i}`,
      status: i % 2 ? 'warn' : 'error',
      details: `деталі ${i}`,
    }));
    const lines = renderHookState(
      {
        stage: 'local',
        checks,
        next: { skill: 'simplycms-diagnose', reason: 'r' },
        unknown: ['deploy.json: збій'],
      } as never,
      false,
    );
    expect(lines.length).toBeLessThanOrEqual(25);
    expect(lines.join('\n')).toContain('не вдалося перевірити: deploy.json');
    expect(lines.at(-1)).toContain('… ще');
    // error-и йдуть перед warn-ами, тож у зрізаному стані warn-ів немає.
    expect(lines.join('\n')).not.toContain('проблема 1\n');
  });
});

describe('simplycms status (CLI)', () => {
  it('тека без магазину → not-created, онбординг, код 3', () => {
    const empty = mkdtempSync(join(tmpdir(), 'cli-st-empty-'));
    roots.push(empty);
    const r = status(empty, '--json');
    const report = JSON.parse(r.out);
    expect(report.stage).toBe('not-created');
    expect(report.next.skill).toBe('simplycms-onboarding');
    expect(report.checks).toEqual([]);
    expect(r.code).toBe(3);
  });

  it('магазин без .simplycms/deploy.json → local; з ним → deployed', async () => {
    const root = await store('st-stage');
    const local = JSON.parse(status(root, '--json').out);
    expect(local.stage).toBe('local');
    mkdirSync(join(root, '.simplycms'));
    writeFileSync(
      join(root, '.simplycms/deploy.json'),
      JSON.stringify(DEPLOY_RECORD),
    );
    const deployed = JSON.parse(status(root, '--json').out);
    expect(deployed.stage).toBe('deployed');
  });

  it('--json парситься з усіма полями контракту', async () => {
    const report = JSON.parse(status(await store('st-json'), '--json').out);
    expect(Object.keys(report).sort()).toEqual([
      'checks',
      'next',
      'stage',
      'unknown',
    ]);
    expect(Array.isArray(report.checks)).toBe(true);
    expect(report.unknown).toEqual([]);
  });

  it('--hook: вступ як у керованому блоці, далі стан ≤25 рядків з етапом і скілом', async () => {
    const r = status(await store('st-hook'), '--hook');
    const intro = extractBlockIntro(renderManagedBlock(INTRO));
    expect(intro).toBe(INTRO.trim());
    expect(r.out.startsWith(`${intro}\n`)).toBe(true);
    const state = r.out.slice(intro.length).trim().split('\n');
    expect(state.length).toBeLessThanOrEqual(25);
    const text = state.join('\n');
    expect(text).toContain('local');
    expect(text).toContain('simplycms-');
  });

  it('№17 engines: плагін, що не покриває ядро, видно в --hook, код 3', async () => {
    const r = status(await store('st-eng'), '--hook');
    expect(r.out).toContain('✗');
    expect(r.out).toContain('hello-world');
    expect(r.out).toContain('онови плагін або відкоти ядро');
    expect(r.code).toBe(3);
  });

  it('--hook з --production і невідомий аргумент — помилка використання', async () => {
    const root = await store('st-args');
    expect(status(root, '--hook', '--production').code).toBe(1);
    expect(status(root, '--json', '--hook').code).toBe(1);
    expect(status(root, '--bogus').code).toBe(1);
  });
  it('битий deploy.json → unknown, stage local, код 1; --hook називає збій', async () => {
    const root = await store('st-bad-deploy');
    mkdirSync(join(root, '.simplycms'));
    writeFileSync(join(root, '.simplycms/deploy.json'), '{bad');
    const r = status(root, '--json');
    const report = JSON.parse(r.out);
    expect(report.stage).toBe('local');
    expect(report.unknown).toHaveLength(1);
    expect(r.code).toBe(1);
    const hook = status(root, '--hook');
    expect(hook.out).toContain('не вдалося перевірити');
    expect(hook.code).toBe(1);
  });
});
