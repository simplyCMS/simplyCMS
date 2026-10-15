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
        PROVISION_RETRY_MS: '1',
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

  it('set --from-secrets: значення з файлу секретів, не у вивід; решта блоку незмінна', () => {
    const sb = sandbox();
    const vals = join(sb.cwd, 'vals.env');
    writeFileSync(vals, `A=${SECRET}\nEMPTY=\n`);
    const a = [
      'set',
      'A',
      '--from-secrets',
      vals,
      '--confirm',
      ...ENV_ARGS,
      sb.secrets,
    ];
    const r = run(sb, 'dokploy-env.mjs', a, envRoutes());
    expect(r.code).toBe(0);
    expect(r.out + r.err).not.toContain(SECRET);
    expect(nonGet(sb.log)[0].body?.env).toBe(
      ENV_BLOCK.replace('A=1', `A=${SECRET}`),
    );
    for (const key of ['EMPTY', 'MISSING']) {
      const bad = run(
        sb,
        'dokploy-env.mjs',
        [
          'set',
          key,
          '--from-secrets',
          vals,
          '--confirm',
          ...ENV_ARGS,
          sb.secrets,
        ],
        envRoutes(),
      );
      expect(bad.code).toBe(2);
      expect(bad.err).toContain(key);
    }
  });

  it.each(['stdin', 'from-secrets'])(
    'set відмовляє на значенні з @pending: (%s)',
    (way) => {
      const sb = sandbox();
      const url = 'postgresql://app_runtime:pw@pending:5432/shop';
      const vals = join(sb.cwd, 'vals.env');
      writeFileSync(vals, `DATABASE_URL=${url}\n`);
      const extra = way === 'stdin' ? [] : ['--from-secrets', vals];
      const r = run(
        sb,
        'dokploy-env.mjs',
        ['set', 'DATABASE_URL', ...extra, '--confirm', ...ENV_ARGS, sb.secrets],
        envRoutes(),
        way === 'stdin' ? url : '',
      );
      expect(r.code).toBe(2);
      expect(r.err).toContain('provision');
      expect(r.err).not.toContain('pw@');
      expect(nonGet(sb.log)).toEqual([]);
    },
  );

  it('set зберігає buildArgs і buildSecrets застосунку', () => {
    const sb = sandbox();
    const routes = envRoutes();
    routes['GET application.one'] = {
      body: { env: ENV_BLOCK, buildArgs: 'X=1', buildSecrets: 'Y=2' },
    };
    run(
      sb,
      'dokploy-env.mjs',
      ['set', 'A', '--confirm', ...ENV_ARGS, sb.secrets],
      routes,
      'v',
    );
    const [save] = nonGet(sb.log);
    expect(save.body?.buildArgs).toBe('X=1');
    expect(save.body?.buildSecrets).toBe('Y=2');
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

  const keysWithUrl = (url: string, routes: Routes = envRoutes()) => {
    const sb = sandbox();
    writeFileSync(
      sb.secrets,
      `DOKPLOY_URL=${url}\nDOKPLOY_API_KEY=${SECRET}\n`,
    );
    return run(
      sb,
      'dokploy-env.mjs',
      ['keys', ...ENV_ARGS, sb.secrets],
      routes,
    );
  };

  it('http-панель не на loopback → одне попередження без ключа й URL', () => {
    const r = keysWithUrl('http://203.0.113.7:3000');
    expect(r.err.match(/DOKPLOY_URL не https/g)).toHaveLength(1);
    expect(r.err + r.out).not.toContain(SECRET);
    expect(r.err + r.out).not.toContain('203.0.113.7');
  });

  it.each([
    'https://dok.example.com',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://[::1]:3000',
  ])('%s → без попередження', (url) => {
    expect(keysWithUrl(url).err).not.toContain('не https');
  });

  it('відповідь не JSON → помилка без уривка тіла', () => {
    const MARK = 'LEAK-MARKER-42';
    const r = keysWithUrl('https://dok.example.com', {
      'GET application.one': { raw: `<html>${MARK}`, status: 200 },
    });
    expect(r.code).toBe(1);
    expect(r.err).toContain('відповідь не JSON (HTTP 200)');
    expect(r.err + r.out).not.toContain(MARK);
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

  it('відсутній файл скрипта → зрозуміла помилка (код 2), не стек, запитів немає', () => {
    const sb = sandbox();
    const r = run(
      sb,
      'prod-run.mjs',
      ['--server', 'srv', '--confirm', '--secrets', sb.secrets, 'немає.sh'],
      ok,
    );
    expect(r.code).toBe(2);
    expect(r.err).toContain('Скрипт не прочитано');
    expect(r.err).not.toContain('at ');
    expect(requests(sb.log)).toEqual([]);
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

  it('підкоманди pipe немає: значення не друкується, код 2', () => {
    const sb = sandbox();
    writeFileSync(join(sb.cwd, 's.env'), `DATABASE_URL=${SECRET}\n`);
    const r = sf(sb.cwd, ['pipe', 's.env', 'DATABASE_URL']);
    expect(r.status).toBe(2);
    expect(r.stdout + r.stderr).not.toContain(SECRET);
  });

  it('init не перезаписує наявний файл, gen не затирає заповнений ключ', () => {
    const sb = sandbox();
    sf(sb.cwd, ['init', 's.env']);
    const path = join(sb.cwd, 's.env');
    writeFileSync(path, `DATABASE_URL=${SECRET}\nBETTER_AUTH_SECRET=\n`);
    chmodSync(path, 0o600);
    expect(sf(sb.cwd, ['init', 's.env']).stdout).not.toContain(SECRET);
    expect(readFileSync(path, 'utf8')).toContain(SECRET);
    const gen = sf(sb.cwd, ['gen', 's.env', 'BETTER_AUTH_SECRET']);
    expect(gen.status).toBe(0);
    expect(gen.stdout).not.toMatch(/[0-9a-f]{64}/);
    expect(readFileSync(path, 'utf8')).toMatch(
      /^BETTER_AUTH_SECRET=[0-9a-f]{64}$/m,
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
  const db = {
    name: 'shop-db',
    appName: 'shop-db-ab12',
    postgresId: 'pg1',
    applicationStatus: 'done',
  };
  const web = { name: 'shop-web', applicationId: 'app1' };
  const full = { body: [project({ postgres: [db], applications: [web] })] };
  const created: Routes = {
    'GET project.all': [
      { body: [] },
      { body: [project()] },
      { body: [project({ postgres: [db] })] },
      full,
    ],
    'POST project.create': { body: {} },
    'POST postgres.create': { body: {} },
    'POST postgres.deploy': { body: {} },
    'POST application.create': { body: {} },
    'POST domain.create': { body: {} },
  };
  const existing: Routes = {
    'GET project.all': full,
    'GET domain.byApplicationId': { body: [{ host: 'shop.example.com' }] },
    'POST postgres.deploy': { body: {} },
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
  const DB_URLS =
    'MIGRATION_DATABASE_URL=postgresql://postgres:p1@shop-db-ab12:5432/shop\nDATABASE_URL=postgresql://app_runtime:p2@shop-db-ab12:5432/shop\n';
  const withSecrets = (sb: ReturnType<typeof sandbox>) =>
    writeFileSync(sb.secrets, readFileSync(sb.secrets, 'utf8') + DB_URLS);

  /** Магазин із шимом `node_modules/.bin/simplycms` → справжній CLI. */
  async function store() {
    const roots: string[] = [];
    const root = await scaffoldFakeStore('shop', roots);
    dirs.push(...roots);
    mkdirSync(join(root, 'node_modules/.bin'), { recursive: true });
    const shim = join(root, 'node_modules/.bin/simplycms');
    writeFileSync(shim, `#!/bin/sh\nexec node ${CLI_INDEX} "$@"\n`);
    chmodSync(shim, 0o755);
    return root;
  }
  const record = (root: string) => join(root, '.simplycms/deploy.json');

  it("без --confirm → код 3, жодного не-GET, прев'ю з сервером і записом deploy.json", async () => {
    const sb = sandbox();
    const root = await store();
    const r = run(
      sb,
      'dokploy.mjs',
      args(sb, ['--server', 'srv1']),
      created,
      '',
      root,
    );
    expect(r.code).toBe(3);
    expect(r.out).toContain('Postgres 17');
    expect(r.out).toContain('на сервері srv1');
    expect(r.out).toContain('.simplycms/deploy.json');
    expect(nonGet(sb.log)).toEqual([]);
    expect(existsSync(record(root))).toBe(false);
  });

  it("без --server прев'ю явно каже про хост панелі", async () => {
    const sb = sandbox();
    const r = run(sb, 'dokploy.mjs', args(sb), created, '', await store());
    expect(r.out).toContain('на хості панелі Dokploy');
  });

  it('усе існує, без --confirm → код 3, deploy.json не створено', async () => {
    const sb = sandbox();
    withSecrets(sb);
    const root = await store();
    const r = run(sb, 'dokploy.mjs', args(sb), existing, '', root);
    expect(r.code).toBe(3);
    expect(nonGet(sb.log)).toEqual([]);
    expect(existsSync(record(root))).toBe(false);
  });

  it('усе існує і запис є → код 0, нічого не створює', async () => {
    const sb = sandbox();
    withSecrets(sb);
    const root = await store();
    expect(
      run(sb, 'dokploy.mjs', args(sb, ['--confirm']), existing, '', root).code,
    ).toBe(0); // пише deploy.json
    const again = run(
      sb,
      'dokploy.mjs',
      args(sb, ['--confirm']),
      existing,
      '',
      root,
    );
    expect(again.code).toBe(0);
    expect(again.out).toContain('Усе вже створено');
    expect(nonGet(sb.log)).toEqual([]);
  });

  it('створює ресурси на --server, запускає БД, пароль лише у файлі секретів, deploy.json зі значень Dokploy', async () => {
    const sb = sandbox();
    const root = await store();
    const r = run(
      sb,
      'dokploy.mjs',
      args(sb, ['--confirm', '--server', 'srv1']),
      created,
      '',
      root,
    );
    expect(r.code).toBe(0);
    const calls = nonGet(sb.log);
    const pg = calls.find((q) => q.path === 'postgres.create')!;
    expect(pg.body?.dockerImage).toBe('postgres:17');
    expect(pg.body?.serverId).toBe('srv1');
    expect(
      calls.find((q) => q.path === 'application.create')?.body?.serverId,
    ).toBe('srv1');
    expect(calls.find((q) => q.path === 'postgres.deploy')?.body).toEqual({
      postgresId: 'pg1',
    });
    const password = String(pg.body?.databasePassword);
    expect(r.out + r.err).not.toContain(password);
    const saved = readFileSync(sb.secrets, 'utf8');
    expect(saved).toContain(
      `MIGRATION_DATABASE_URL=postgresql://postgres:${password}@shop-db-ab12:5432/shop`,
    );
    expect(saved).toMatch(
      /^DATABASE_URL=postgresql:\/\/app_runtime:[0-9a-f]{48}@shop-db-ab12:5432\/shop$/m,
    );
    expect(statSync(sb.secrets).mode & 0o777).toBe(0o600);
    expect(JSON.parse(readFileSync(record(root), 'utf8'))).toEqual({
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

  it('без --server поле serverId у create не передається', async () => {
    const sb = sandbox();
    run(sb, 'dokploy.mjs', args(sb, ['--confirm']), created, '', await store());
    const pg = nonGet(sb.log).find((q) => q.path === 'postgres.create')!;
    expect(pg.body).not.toHaveProperty('serverId');
  });

  it("БД є, але не запущена (idle) → у прев'ю «запустити», з --confirm — postgres.deploy", async () => {
    const sb = sandbox();
    withSecrets(sb);
    const idle = {
      body: [
        project({
          postgres: [{ ...db, applicationStatus: 'idle' }],
          applications: [web],
        }),
      ],
    };
    const routes = { ...existing, 'GET project.all': idle };
    const root = await store();
    const preview = run(sb, 'dokploy.mjs', args(sb), routes, '', root);
    expect(preview.out).toContain('запустити Postgres');
    expect(nonGet(sb.log)).toEqual([]);
    run(sb, 'dokploy.mjs', args(sb, ['--confirm']), routes, '', root);
    expect(nonGet(sb.log).map((q) => q.path)).toContain('postgres.deploy');
  });

  it('обрив після postgres.create: пароль уже у файлі секретів, повтор доводить хост', async () => {
    const sb = sandbox();
    const root = await store();
    const broken = {
      ...created,
      'POST postgres.create': { status: 500, body: {} },
    };
    expect(
      run(sb, 'dokploy.mjs', args(sb, ['--confirm']), broken, '', root).code,
    ).toBe(1);
    const saved = readFileSync(sb.secrets, 'utf8');
    expect(saved).toMatch(
      /^MIGRATION_DATABASE_URL=postgresql:\/\/postgres:[0-9a-f]{48}@pending:5432\/shop$/m,
    );
    const retry = run(
      sb,
      'dokploy.mjs',
      args(sb, ['--confirm']),
      {
        ...created,
        'GET project.all': [{ body: [project({ postgres: [db] })] }, full],
      },
      '',
      root,
    );
    expect(retry.code).toBe(0);
    expect(readFileSync(sb.secrets, 'utf8')).toContain(
      '@shop-db-ab12:5432/shop',
    );
    expect(readFileSync(sb.secrets, 'utf8')).not.toContain('@pending:');
  });

  it('БД є, а URL у файлі секретів немає → явна помилка з дією', async () => {
    const sb = sandbox();
    const r = run(
      sb,
      'dokploy.mjs',
      args(sb, ['--confirm']),
      existing,
      '',
      await store(),
    );
    expect(r.code).toBe(1);
    expect(r.err).toContain('пароль власника втрачено');
    expect(r.err).toContain('MIGRATION_DATABASE_URL');
    expect(nonGet(sb.log)).toEqual([]);
  });

  it('Dokploy не показує створену БД → зрозуміла помилка, не TypeError', async () => {
    const sb = sandbox();
    const blind = {
      ...created,
      'GET project.all': [{ body: [] }, { body: [project()] }],
    };
    const r = run(
      sb,
      'dokploy.mjs',
      args(sb, ['--confirm']),
      blind,
      '',
      await store(),
    );
    expect(r.code).toBe(1);
    expect(r.err).toContain('ще не показує shop-db');
    expect(r.err).not.toContain('TypeError');
  });

  const PENDING =
    'MIGRATION_DATABASE_URL=postgresql://postgres:ownerpw@pending:5432/shop\nDATABASE_URL=postgresql://app_runtime:rtpw@pending:5432/shop\n';

  it('обрив і повтор: паролі з тимчасових URL перевикористовуються, не перегенеровуються', async () => {
    const sb = sandbox();
    writeFileSync(sb.secrets, readFileSync(sb.secrets, 'utf8') + PENDING);
    run(sb, 'dokploy.mjs', args(sb, ['--confirm']), created, '', await store());
    const pg = nonGet(sb.log).find((q) => q.path === 'postgres.create')!;
    expect(pg.body?.databasePassword).toBe('ownerpw');
    expect(readFileSync(sb.secrets, 'utf8')).toContain(
      'app_runtime:rtpw@shop-db-ab12',
    );
  });

  it("внесені власником URL без БД: прев'ю називає ключі, перезапис лише з --confirm", async () => {
    const sb = sandbox();
    writeFileSync(
      sb.secrets,
      readFileSync(sb.secrets, 'utf8') +
        'DATABASE_URL=postgresql://own:mine@host:5432/x\n',
    );
    const root = await store();
    const preview = run(sb, 'dokploy.mjs', args(sb), created, '', root);
    expect(preview.code).toBe(3);
    expect(preview.out).toContain(
      'перезаписати DATABASE_URL, MIGRATION_DATABASE_URL',
    );
    expect(preview.out).not.toContain('mine');
    expect(readFileSync(sb.secrets, 'utf8')).toContain('own:mine@host');
    run(sb, 'dokploy.mjs', args(sb, ['--confirm']), created, '', root);
    expect(readFileSync(sb.secrets, 'utf8')).not.toContain('own:mine@host');
  });

  it.each([
    ['running', false],
    ['done', false],
    ['error', true],
    [undefined, true],
  ])("статус БД %s: примітка у прев'ю = %s", async (status, noted) => {
    const sb = sandbox();
    withSecrets(sb);
    const odd = { ...db, applicationStatus: status };
    const routes = {
      ...existing,
      'GET project.all': {
        body: [project({ postgres: [odd], applications: [web] })],
      },
    };
    const r = run(sb, 'dokploy.mjs', args(sb), routes, '', await store());
    expect(r.out.includes('статус БД')).toBe(noted);
    if (noted)
      expect(r.out).toContain(
        `статус БД ${status ?? 'невідомий'}: перевір у Dokploy`,
      );
    expect(nonGet(sb.log)).toEqual([]);
  });

  it('немає node_modules/.bin/simplycms → змістовна помилка', () => {
    const sb = sandbox();
    withSecrets(sb);
    const r = run(sb, 'dokploy.mjs', args(sb), existing);
    expect(r.code).toBe(1);
    expect(r.err).toContain('node_modules/.bin');
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

  it.each(['SKILL.md', 'references/dokploy.md'])(
    "%s: правило прев'ю → згода поширено на MCP, UI і скрипти",
    (file) => {
      const text = read(file);
      expect(text).toMatch(/прев'ю → згода/);
      expect(text).toMatch(/MCP/);
    },
  );

  it('у текстах немає pipe, є --from-secrets', () => {
    for (const file of [
      'SKILL.md',
      'references/dokploy.md',
      'references/smtp.md',
      'references/garage-bucket.md',
    ])
      expect(read(file)).not.toMatch(/\bpipe\b/);
    expect(read('SKILL.md')).toContain('--from-secrets');
    expect(read('references/dokploy.md')).toContain('--from-secrets');
  });

  it('SKILL.md: правило діє на будь-яку мутацію', () => {
    expect(read('SKILL.md')).toContain('БУДЬ-ЯКУ мутацію');
  });

  it('dokploy.md: RAILPACK_* через dokploy-env зі stdin, деплой і бекапи після згоди', () => {
    const text = read('references/dokploy.md');
    expect(text).toContain('`dokploy-env set` зі stdin');
    expect(text).toMatch(/Деплой — теж мутація/);
    expect(text).toMatch(/## 5\. Бекапи\n\nМутація: прев'ю → згода/);
  });

  it('dokploy.md: стартова команда, Node 24, postgres:18, без --print-link', () => {
    const text = read('references/dokploy.md');
    expect(text).toContain('RAILPACK_START_CMD="node scripts/start.mjs"');
    expect(text).toContain('RAILPACK_NODE_VERSION=24');
    expect(text).toContain('postgres:18');
    expect(text).toContain('без `--print-link`');
    expect(text).not.toMatch(/owner-invite\.mjs\s+--print-link/);
  });
});
