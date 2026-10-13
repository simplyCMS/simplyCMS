import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { CLI_INDEX, scaffoldFakeStore } from './lib/fake-core-store';

// Скіл simplycms-onboarding (К3-Е8, Task 22): справжні запуски скриптів у дочірньому
// процесі з підміною fetch (`tests/lib/fake-dokploy-fetch.mjs`) — без мережі.
const SKILL = join(
  process.cwd(),
  'packages/simplycms/skills/simplycms-onboarding',
);
const FAKE = join(process.cwd(), 'tests/lib/fake-dokploy-fetch.mjs');
const SECRET = 's3cr3t-value-XYZ';
const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

type Req = {
  method: string;
  path: string;
  body: Record<string, unknown> | null;
};
type Routes = Record<string, unknown>;

function sandbox() {
  const cwd = mkdtempSync(join(tmpdir(), 'onboard-'));
  dirs.push(cwd);
  const secrets = join(cwd, 'secrets.env');
  writeFileSync(
    secrets,
    'DOKPLOY_URL=https://dok.example.com\nDOKPLOY_API_KEY=k\n',
  );
  return { cwd, secrets, log: join(cwd, 'requests.log') };
}
const requests = (log: string): Req[] =>
  existsSync(log)
    ? readFileSync(log, 'utf8')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l))
    : [];
const nonGet = (log: string) => requests(log).filter((r) => r.method !== 'GET');

function run(
  sb: ReturnType<typeof sandbox>,
  script: string,
  args: string[],
  routes: Routes = {},
  input = '',
  cwd = sb.cwd,
) {
  const r = spawnSync(
    'node',
    ['--import', FAKE, join(SKILL, 'scripts', script), ...args],
    {
      cwd,
      input,
      encoding: 'utf8',
      env: {
        ...process.env,
        DOKPLOY_URL: '',
        DOKPLOY_API_KEY: '',
        FAKE_ROUTES: JSON.stringify(routes),
        FAKE_LOG: sb.log,
        PROD_RUN_POLL_MS: '10',
      },
    },
  );
  return { code: r.status, out: r.stdout, err: r.stderr };
}

const ENV_BLOCK = '# коментар\nA=1\n\nB="два  пробіли"\nKEEP=x=y';
const envRoutes = (): Routes => ({
  'GET application.one': { body: { env: ENV_BLOCK } },
  'POST application.saveEnvironment': { body: {} },
});
const ENV_ARGS = ['--app', 'app1', '--secrets'];

describe('dokploy-env', () => {
  it('set з TTY на stdin → код 2, запитів немає', () => {
    const sb = sandbox();
    const cmd = `node --import ${FAKE} ${join(SKILL, 'scripts/dokploy-env.mjs')} set NEW_KEY --confirm ${ENV_ARGS.join(' ')} ${sb.secrets}`;
    const r = spawnSync('script', ['-qec', cmd, '/dev/null'], {
      cwd: sb.cwd,
      encoding: 'utf8',
      env: { ...process.env, FAKE_ROUTES: '{}', FAKE_LOG: sb.log },
    });
    expect(r.status).toBe(2);
    // Саме відмова на TTY, а не «порожній stdin» (pty віддає EOF і без неї).
    expect(r.stdout).toContain('не з клавіатури');
    expect(requests(sb.log)).toEqual([]);
  });

  it.each([
    ['порожній stdin', ''],
    ['лише перенос рядка', '\n'],
    ['перенос усередині', 'a\nb'],
  ])('set: %s → код 2', (_name, input) => {
    const sb = sandbox();
    const r = run(
      sb,
      'dokploy-env.mjs',
      ['set', 'K', '--confirm', ...ENV_ARGS, sb.secrets],
      envRoutes(),
      input,
    );
    expect(r.code).toBe(2);
    expect(requests(sb.log)).toEqual([]);
  });

  it('без --confirm → код 3 і жодного не-GET запиту, значення не показано', () => {
    const sb = sandbox();
    const r = run(
      sb,
      'dokploy-env.mjs',
      ['set', 'K', ...ENV_ARGS, sb.secrets],
      envRoutes(),
      SECRET,
    );
    expect(r.code).toBe(3);
    expect(r.out).toContain('K');
    expect(r.out + r.err).not.toContain(SECRET);
    expect(nonGet(sb.log)).toEqual([]);
  });

  it('set: createEnvFile:false, змінено рівно один ключ, решта блоку байт-у-байт, значення не у виводі', () => {
    const sb = sandbox();
    const r = run(
      sb,
      'dokploy-env.mjs',
      ['set', 'A', '--confirm', ...ENV_ARGS, sb.secrets],
      envRoutes(),
      `${SECRET}\n`,
    );
    expect(r.code).toBe(0);
    expect(r.out + r.err).not.toContain(SECRET);
    const [save] = nonGet(sb.log);
    expect(save.path).toBe('application.saveEnvironment');
    expect(save.body?.createEnvFile).toBe(false);
    expect(save.body?.applicationId).toBe('app1');
    expect(save.body?.env).toBe(ENV_BLOCK.replace('A=1', `A=${SECRET}`));
  });

  it('unset видаляє один ключ, решта незмінна', () => {
    const sb = sandbox();
    const r = run(
      sb,
      'dokploy-env.mjs',
      ['unset', 'B', '--confirm', ...ENV_ARGS, sb.secrets],
      envRoutes(),
    );
    expect(r.code).toBe(0);
    expect(nonGet(sb.log)[0].body?.env).toBe('# коментар\nA=1\n\nKEEP=x=y');
  });

  it('облікові дані беруться з файлу секретів, а не з ~/.claude.json', () => {
    const sb = sandbox();
    writeFileSync(sb.secrets, '');
    const r = run(
      sb,
      'dokploy-env.mjs',
      ['keys', ...ENV_ARGS, sb.secrets],
      envRoutes(),
    );
    expect(r.code).toBe(1);
    expect(r.err).toContain('DOKPLOY_API_KEY');
  });
});

describe('prod-run', () => {
  const ok = {
    'POST schedule.create': { body: { scheduleId: 's1' } },
    'POST schedule.runManually': {
      body: { deploymentId: 'd1', status: 'done' },
    },
    'GET deployment.readLogs': {
      body: 'Running script\nпривіт\nCommand executed successfully',
    },
    'POST schedule.delete': { body: {} },
  };

  it("без --confirm → код 3, прев'ю скрипта, жодного не-GET запиту", () => {
    const sb = sandbox();
    const r = run(
      sb,
      'prod-run.mjs',
      ['--server', 'srv', '--secrets', sb.secrets],
      ok,
      'echo hi\n',
    );
    expect(r.code).toBe(3);
    expect(r.out).toContain('echo hi');
    expect(nonGet(sb.log)).toEqual([]);
  });

  it('успіх: друкує вивід без службових рядків і видаляє завдання', () => {
    const sb = sandbox();
    const r = run(
      sb,
      'prod-run.mjs',
      ['--server', 'srv', '--confirm', '--secrets', sb.secrets],
      ok,
      'echo hi\n',
    );
    expect(r.code).toBe(0);
    expect(r.out.trim()).toBe('привіт');
    expect(nonGet(sb.log).map((q) => q.path)).toEqual([
      'schedule.create',
      'schedule.runManually',
      'schedule.delete',
    ]);
  });

  it('помилка runManually: schedule.delete усе одно викликано, код 1', () => {
    const sb = sandbox();
    const routes = {
      ...ok,
      'POST schedule.runManually': { status: 500, body: {} },
    };
    const r = run(
      sb,
      'prod-run.mjs',
      ['--server', 'srv', '--confirm', '--secrets', sb.secrets],
      routes,
      'echo hi\n',
    );
    expect(r.code).toBe(1);
    const del = nonGet(sb.log).find((q) => q.path === 'schedule.delete');
    expect(del?.body).toEqual({ scheduleId: 's1' });
  });
});

describe('secrets-file', () => {
  const sf = (cwd: string, args: string[]) =>
    spawnSync('node', [join(SKILL, 'scripts/secrets-file.mjs'), ...args], {
      cwd,
      encoding: 'utf8',
    });

  it('init: файл 0600 з порожніми ключами, шлях у .gitignore, значень немає', () => {
    const sb = sandbox();
    const r = sf(sb.cwd, ['init', '.simplycms/secrets.env']);
    expect(r.status).toBe(0);
    const path = join(sb.cwd, '.simplycms/secrets.env');
    expect(statSync(path).mode & 0o777).toBe(0o600);
    expect(readFileSync(path, 'utf8')).toMatch(/^DOKPLOY_API_KEY=$/m);
    expect(readFileSync(join(sb.cwd, '.gitignore'), 'utf8')).toContain(
      '.simplycms/secrets.env',
    );
  });

  it('init не перезаписує наявний файл; pipe віддає значення без нового рядка, gen не затирає', () => {
    const sb = sandbox();
    sf(sb.cwd, ['init', 's.env']);
    const path = join(sb.cwd, 's.env');
    writeFileSync(path, `DATABASE_URL=${SECRET}\nBETTER_AUTH_SECRET=\n`);
    chmodSync(path, 0o600);
    expect(sf(sb.cwd, ['init', 's.env']).stdout).not.toContain(SECRET);
    expect(readFileSync(path, 'utf8')).toContain(SECRET);
    expect(sf(sb.cwd, ['pipe', 's.env', 'DATABASE_URL']).stdout).toBe(SECRET);
    expect(sf(sb.cwd, ['pipe', 's.env', 'BETTER_AUTH_SECRET']).status).toBe(1);
    expect(sf(sb.cwd, ['gen', 's.env', 'BETTER_AUTH_SECRET']).status).toBe(0);
    expect(sf(sb.cwd, ['pipe', 's.env', 'BETTER_AUTH_SECRET']).stdout).toMatch(
      /^[0-9a-f]{64}$/,
    );
    expect(sf(sb.cwd, ['gen', 's.env', 'BETTER_AUTH_SECRET']).status).toBe(1);
  });
});

describe('dokploy provision', () => {
  const env = { environmentId: 'env1', name: 'production' };
  const project = (extra = {}) => ({
    projectId: 'pr1',
    name: 'shop',
    environments: [{ ...env, ...extra }],
  });
  const db = { name: 'shop-db', appName: 'shop-db-ab12', postgresId: 'pg1' };
  const web = { name: 'shop-web', applicationId: 'app1' };
  const routes: Routes = {
    'GET project.all': [
      { body: [] },
      { body: [project()] },
      { body: [project({ postgres: [db] })] },
      { body: [project({ postgres: [db], applications: [web] })] },
    ],
    'POST project.create': { body: {} },
    'POST postgres.create': { body: {} },
    'POST application.create': { body: {} },
    'POST domain.create': { body: {} },
  };
  const args = (sb: ReturnType<typeof sandbox>, extra: string[] = []) => [
    'provision',
    '--name',
    'shop',
    '--domain',
    'shop.example.com',
    '--bucket',
    'shop-bucket',
    '--secrets',
    sb.secrets,
    ...extra,
  ];

  it('без --confirm → код 3 і жодного не-GET запиту', () => {
    const sb = sandbox();
    const r = run(sb, 'dokploy.mjs', args(sb), routes);
    expect(r.code).toBe(3);
    expect(r.out).toContain('Postgres 17');
    expect(nonGet(sb.log)).toEqual([]);
  });

  it('створює ресурси (Postgres 17), пароль лише у файлі секретів, deploy.json зі значень Dokploy', async () => {
    const roots: string[] = [];
    const store = await scaffoldFakeStore('shop', roots);
    dirs.push(...roots);
    mkdirSync(join(store, 'node_modules/.bin'), { recursive: true });
    const shim = join(store, 'node_modules/.bin/simplycms');
    writeFileSync(shim, `#!/bin/sh\nexec node ${CLI_INDEX} "$@"\n`);
    chmodSync(shim, 0o755);
    const sb = sandbox();
    const r = run(
      sb,
      'dokploy.mjs',
      args(sb, ['--confirm']),
      routes,
      '',
      store,
    );
    expect(r.code).toBe(0);
    const pg = nonGet(sb.log).find((q) => q.path === 'postgres.create')!;
    expect(pg.body?.dockerImage).toBe('postgres:17');
    const password = String(pg.body?.databasePassword);
    expect(password.length).toBeGreaterThan(20);
    expect(r.out + r.err).not.toContain(password);
    const saved = readFileSync(sb.secrets, 'utf8');
    expect(saved).toContain(
      `MIGRATION_DATABASE_URL=postgresql://postgres:${password}@shop-db-ab12:5432/shop`,
    );
    expect(saved).toMatch(
      /^DATABASE_URL=postgresql:\/\/app_runtime:[0-9a-f]{48}@shop-db-ab12:5432\/shop$/m,
    );
    expect(statSync(sb.secrets).mode & 0o777).toBe(0o600);
    expect(
      JSON.parse(readFileSync(join(store, '.simplycms/deploy.json'), 'utf8')),
    ).toEqual({
      version: 1,
      dokploy: {
        url: 'https://dok.example.com',
        projectId: 'pr1',
        applicationId: 'app1',
        postgresId: 'pg1',
      },
      domain: 'shop.example.com',
      bucket: 'shop-bucket',
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
  });

  it('усе вже існує → нічого не створює (ідемпотентність)', () => {
    const sb = sandbox();
    const full = { body: [project({ postgres: [db], applications: [web] })] };
    const r = run(sb, 'dokploy.mjs', args(sb, ['--confirm']), {
      'GET project.all': full,
      'GET domain.byApplicationId': { body: [{ host: 'shop.example.com' }] },
    });
    expect(r.out).toContain('Усе вже створено');
    expect(nonGet(sb.log)).toEqual([]);
  });
});

describe('тексти скіла', () => {
  const read = (p: string) => readFileSync(join(SKILL, p), 'utf8');

  it('SKILL.md: frontmatter, межі, ≤120 рядків', () => {
    const text = read('SKILL.md');
    expect(text.split('\n').length).toBeLessThanOrEqual(120);
    expect(text).toMatch(
      /^---\nname: simplycms-onboarding\ndescription: [^]*створи магазин/,
    );
    expect(text).toContain('## Межі');
    expect(text).toContain('pnpm simplycms status --json');
  });

  it.each(['SKILL.md', 'references/dokploy.md', 'references/summary.md'])(
    '%s кличе doctor --online --production',
    (file) => {
      expect(read(file)).toContain('doctor --online --production');
    },
  );

  it.each(['references/requirements.md', 'references/dokploy.md'])(
    '%s вимагає власний екземпляр Postgres з причиною',
    (file) => {
      const text = read(file);
      expect(text).toMatch(/власний екземпляр Postgres/i);
      expect(text).toContain('app_runtime');
      expect(text).toContain('app_admin');
    },
  );

  it('dokploy.md: стартова команда, Node 24, postgres:18, без --print-link', () => {
    const text = read('references/dokploy.md');
    expect(text).toContain('RAILPACK_START_CMD="node scripts/start.mjs"');
    expect(text).toContain('RAILPACK_NODE_VERSION=24');
    expect(text).toContain('postgres:18');
    expect(text).toContain('без `--print-link`');
    expect(text).not.toMatch(/owner-invite\.mjs\s+--print-link/);
  });
});
