import {
  appendFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  checkCoreVersions,
  checkEnv,
  runOfflineChecks,
} from '../packages/cli/src/doctor-checks.mjs';
import {
  checkHostDrift,
  checkMigrations,
  checkSkillLinks,
} from '../packages/cli/src/doctor-fs-checks.mjs';
import { checkThemes } from '../packages/cli/src/doctor-theme-checks.mjs';
import { runOnlineChecks } from '../packages/cli/src/doctor-db-checks.mjs';
import {
  computeExitCode,
  offlineOnlyNotice,
  parseDoctorArgs,
} from '../packages/cli/src/doctor.mjs';
import { scaffold } from '../packages/create-simplycms-store/src/scaffold.mjs';

// Оффлайн-перевірки doctor на реальному скаффолді шаблону. Онлайн-перевірок у
// doctor більше НЕМАЄ: вони ходили в HTTP-API бази, а магазин сервер-first —
// HTTP-API до БД у нього немає взагалі (їх повертає контур К3).
//
// 🔴 Env — рівно серверний контракт магазину (0.4.1). Ключів клієнта БД тут бути
// не може: якби checkEnv і далі гейтив їх, doctor зеленів би на магазині, який
// не стартує, і червонів на тому, який працює.
const ENV = {
  DATABASE_URL: 'postgresql://app_runtime:pw@localhost:5432/postgres',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
};

async function scaffoldStore(name: string) {
  const target = join(mkdtempSync(join(tmpdir(), 'cli-doc-')), name);
  await scaffold({
    templateDir: 'packages/create-simplycms-store/template',
    targetDir: target,
    storeName: name,
    version: '9.9.9-sentinel',
  });
  return target;
}

function makeCtx(storeRoot: string) {
  return {
    storeRoot,
    manifest: JSON.parse(readFileSync(join(storeRoot, 'package.json'), 'utf8')),
    env: ENV,
    // Сентинел збігається з версією ядра скаффолда → перевірка версій зелена.
    cliVersion: '9.9.9-sentinel',
    hostDir: join(storeRoot, 'no-canon'), // відсутня тека → skip
    // Міграції ядра лежать на РІВНІ пакета, а не в підтеці схеми.
    schemaMigrationsDir: join(storeRoot, 'node_modules/simplycms/migrations'),
  };
}

describe('cli doctor (оффлайн)', () => {
  it('свіжий скаффолд: усі перевірки ok, дрейф і міграції — «не вдалося»', async () => {
    const checks = runOfflineChecks(makeCtx(await scaffoldStore('doc-ok')));
    const byId = Object.fromEntries(checks.map((c) => [c.id, c.status]));
    expect(byId).toEqual({
      versions: 'ok',
      packageManager: 'ok',
      allowBuilds: 'ok',
      env: 'ok',
      'host-drift': 'skip',
      migrations: 'skip',
      'routes.ts': 'ok',
      'tailwind.config.ts': 'ok',
      'simplycms.config.ts': 'ok',
      themes: 'ok',
      // node_modules ще немає — скіли ядра нема з чим звіряти.
      'skill-links': 'skip',
      // Ядра в node_modules ще немає — peer-діапазон pg невідомий (деталі — cli-pg-driver).
      'pg-driver': 'skip',
    });
    // skip не впливає на exit-код навіть під --strict.
    expect(computeExitCode(checks)).toBe(0);
    expect(computeExitCode(checks, { strict: true })).toBe(0);
  });

  it('checkCoreVersions: розсинхрон версій — error, відставання CLI — warn', () => {
    const drifted = {
      manifest: {
        dependencies: { '@simplycms/ui': '1.0.0', '@simplycms/core': '1.0.1' },
      },
      cliVersion: '1.0.0',
    };
    expect(checkCoreVersions(drifted).status).toBe('error');
    const stale = {
      manifest: { dependencies: { '@simplycms/ui': '1.0.0' } },
      cliVersion: '2.0.0',
    };
    expect(checkCoreVersions(stale).status).toBe('warn');
  });

  it('checkEnv: гейтить DATABASE_URL і BETTER_AUTH_SECRET, не ключі клієнта БД', () => {
    const empty = checkEnv({ env: {} });
    expect(empty.status).toBe('error');
    expect(empty.details).toContain('DATABASE_URL');
    expect(empty.details).toContain('BETTER_AUTH_SECRET');

    // Половина контракту — все ще error, і в тексті рівно те, чого бракує.
    const halfway = checkEnv({ env: { DATABASE_URL: ENV.DATABASE_URL } });
    expect(halfway.status).toBe('error');
    expect(halfway.details).toContain('BETTER_AUTH_SECRET');
    // 🔴 Без двокрапки. `checkEnv` будує текст як `Не задано: ${missing.join('; ')}`,
    // тобто підрядка `DATABASE_URL:` не буває в ЖОДНІЙ реалізації — старий
    // асерт із двокрапкою був no-op і пропускав мутацію «звинувачувати всі
    // ключі, навіть заповнені».
    expect(halfway.details).not.toContain('DATABASE_URL');

    expect(checkEnv({ env: ENV }).status).toBe('ok');
    // 🔴 Ключі поза контрактом його не заміняють: магазин, у якого заповнено
    // лише їх (так виглядав .env.local до 0.4.1 — з ключами клієнта БД), не
    // стартує, тож doctor мусить червоніти, а не зеленіти на «щось задано».
    const outsideContract = { VITE_SITE_URL: 'https://shop.example' };
    const stale = checkEnv({ env: outsideContract });
    expect(stale.status).toBe('error');
    expect(stale.title).toMatch(/DATABASE_URL/);
  });

  it('checkHostDrift: збіг із каноном — ok, локальна правка — warn', async () => {
    const store = await scaffoldStore('doc-drift');
    const hostDir = mkdtempSync(join(tmpdir(), 'cli-canon-'));
    cpSync(join(store, 'routes.ts'), join(hostDir, 'routes.ts'));
    expect(checkHostDrift({ storeRoot: store, hostDir }).status).toBe('ok');
    appendFileSync(join(store, 'routes.ts'), '\n// локальна правка\n');
    const drifted = checkHostDrift({ storeRoot: store, hostDir });
    expect(drifted.status).toBe('warn');
    expect(drifted.details).toContain('routes.ts');
    expect(drifted.details).toContain('update --write');
  });

  it('checkMigrations: skip без schema/migrations, warn про нові, error про змінені', async () => {
    const store = await scaffoldStore('doc-mig');
    const ctx = makeCtx(store);
    expect(checkMigrations(ctx).status).toBe('skip');

    const schemaDir = mkdtempSync(join(tmpdir(), 'cli-schema-'));
    const storeDir = join(store, 'db', 'migrations');
    const [shared] = readdirSync(storeDir).filter((n) => n.endsWith('.sql'));
    cpSync(join(storeDir, shared), join(schemaDir, shared));
    writeFileSync(join(schemaDir, '99999999999999_new.sql'), 'select 1;\n');
    const lag = checkMigrations({
      storeRoot: store,
      schemaMigrationsDir: schemaDir,
    });
    expect(lag.status).toBe('warn');
    expect(lag.details).toContain('99999999999999_new.sql');
    expect(lag.details).toContain('db:diff --write');

    writeFileSync(join(schemaDir, shared), '-- інший вміст\n');
    const changed = checkMigrations({
      storeRoot: store,
      schemaMigrationsDir: schemaDir,
    });
    expect(changed.status).toBe('error');
    expect(changed.details).toContain(shared);
  });

  it('checkMigrations: канон є, а db/migrations немає — error із назвою теки', async () => {
    const store = await scaffoldStore('doc-mig-gone');
    rmSync(join(store, 'db', 'migrations'), { recursive: true });
    const schemaDir = mkdtempSync(join(tmpdir(), 'cli-schema-'));
    writeFileSync(join(schemaDir, '0000_prelude.sql'), 'select 1;\n');
    const res = checkMigrations({
      storeRoot: store,
      schemaMigrationsDir: schemaDir,
    });
    expect(res.status).toBe('error');
    expect(res.details).toContain('db/migrations');
    expect(res.details).not.toContain('git mv');
  });

  it('checkMigrations: стара supabase/migrations — error з підказкою git mv', async () => {
    const store = await scaffoldStore('doc-mig-legacy');
    rmSync(join(store, 'db', 'migrations'), { recursive: true });
    mkdirSync(join(store, 'supabase', 'migrations'), { recursive: true });
    writeFileSync(
      join(store, 'supabase', 'migrations', '0001_init.sql'),
      'select 1;\n',
    );
    const schemaDir = mkdtempSync(join(tmpdir(), 'cli-schema-'));
    writeFileSync(join(schemaDir, '0000_prelude.sql'), 'select 1;\n');
    const res = checkMigrations({
      storeRoot: store,
      schemaMigrationsDir: schemaDir,
    });
    expect(res.status).toBe('error');
    expect(res.details).toContain('git mv supabase/migrations db/migrations');
  });

  it('checkMigrations: db/migrations — файл, а не тека → зрозумілий error, без ENOTDIR', async () => {
    const store = await scaffoldStore('doc-mig-file');
    rmSync(join(store, 'db', 'migrations'), { recursive: true });
    writeFileSync(join(store, 'db', 'migrations'), 'не тека\n');
    const schemaDir = mkdtempSync(join(tmpdir(), 'cli-schema-'));
    writeFileSync(join(schemaDir, '0000_prelude.sql'), 'select 1;\n');
    const res = checkMigrations({
      storeRoot: store,
      schemaMigrationsDir: schemaDir,
    });
    expect(res.status).toBe('error');
    expect(res.details).toContain('db/migrations');
    expect(res.details).toContain('не тека');
  });

  it('checkThemes: нерезолвний запис — warn; warn не валить прогін без --strict', async () => {
    const store = await scaffoldStore('doc-theme');
    const configPath = join(store, 'simplycms.config.ts');
    writeFileSync(
      configPath,
      readFileSync(configPath, 'utf8').replace(
        'themes: {',
        "themes: {\n    ghost: () => import('@themes/ghost/index'),",
      ),
    );
    const missing = checkThemes({ storeRoot: store });
    expect(missing.status).toBe('warn');
    expect(missing.details).toContain('ghost');
    expect(computeExitCode([missing])).toBe(0);
    expect(computeExitCode([missing], { strict: true })).toBe(1);
  });

  it('checkThemes: стороння тема без Tailwind-глоба — warn із підказкою', async () => {
    const store = await scaffoldStore('doc-theme-glob');
    const configPath = join(store, 'simplycms.config.ts');
    const tailwindPath = join(store, 'tailwind.config.ts');
    writeFileSync(
      configPath,
      readFileSync(configPath, 'utf8').replace(
        'themes: {',
        "themes: {\n    aurora: () => import('@acme/simplycms-theme-aurora'),",
      ),
    );
    // Пакет на місці — лишається сама лише проблема глоба.
    mkdirSync(join(store, 'node_modules/@acme/simplycms-theme-aurora'), {
      recursive: true,
    });
    // 🔴 Свіжий магазин глоби Р7 уже має (шаблон, Фаза 4) — тож підказки тут
    // бути НЕ повинно. Це і є перший асерт: інакше doctor шумів би на кожному
    // новому магазині зі сторонньою темою.
    expect(checkThemes({ storeRoot: store }).status).toBe('ok');

    // Магазин, скаффолджений ДО Фази 4: `tailwind.config.ts` поза каноном
    // host/, тож `update --write` глоби не довезе — лагодиться руками, і саме
    // на це наводить підказка. Моделюємо станом без глобів.
    writeFileSync(
      tailwindPath,
      readFileSync(tailwindPath, 'utf8').replace(
        /^.*simplycms-theme-\*.*$\n/gm,
        '',
      ),
    );
    const hint = checkThemes({ storeRoot: store });
    expect(hint.status).toBe('warn');
    expect(hint.details).toContain('simplycms-theme-*');
    expect(hint.details).not.toContain('немає ні теки');

    // Референс-тема ядра підказки НЕ дає навіть без глобів Р7: її покриває
    // давній глоб `@simplycms/*`.
    writeFileSync(
      configPath,
      readFileSync(configPath, 'utf8').replace(
        '@acme/simplycms-theme-aurora',
        '@simplycms/theme-solarstore',
      ),
    );
    mkdirSync(join(store, 'node_modules/@simplycms/theme-solarstore'), {
      recursive: true,
    });
    expect(checkThemes({ storeRoot: store }).status).toBe('ok');
  });

  // Каркас магазину під топологію 5: роути монтуються підтеками ОДНОГО
  // пакета, Tailwind сканує його ж. Магазин, скаффолджений до К0, тут має
  // червоніти — інакше він мовчки збереться без роутів ядра.
  it('якірні файли: старий каркас на два route-пакети — error', async () => {
    const store = await scaffoldStore('doc-legacy-routes');
    writeFileSync(
      join(store, 'routes.ts'),
      "import { physical, rootRoute } from '@tanstack/virtual-file-routes';\n" +
        "export const routes = rootRoute('__root.tsx', [\n" +
        "  physical('', '../node_modules/@simplycms/storefront-routes/routes'),\n" +
        "  physical('', '../node_modules/@simplycms/admin-routes/routes'),\n" +
        ']);\n',
    );
    const tailwindPath = join(store, 'tailwind.config.ts');
    writeFileSync(
      tailwindPath,
      readFileSync(tailwindPath, 'utf8').replace(
        /^.*node_modules\/simplycms\/.*$\n/gm,
        '',
      ),
    );
    const byId = Object.fromEntries(
      runOfflineChecks(makeCtx(store)).map((c) => [c.id, c.status]),
    );
    expect(byId['routes.ts']).toBe('error');
    expect(byId['tailwind.config.ts']).toBe('error');
  });

  it('checkSkillLinks: skip без skills/ у ядрі, warn без лінків, ok з лінками', async () => {
    const store = await scaffoldStore('doc-skills');
    expect(checkSkillLinks({ storeRoot: store }).status).toBe('skip');

    const skills = join(store, 'node_modules/simplycms/skills');
    mkdirSync(join(skills, 'redesign-from-reference'), { recursive: true });
    const missing = checkSkillLinks({ storeRoot: store });
    expect(missing.status).toBe('warn');
    expect(missing.details).toContain('redesign-from-reference');
    expect(missing.details).toContain('simplycms update');

    for (const dir of ['.agents/skills', '.claude/skills']) {
      mkdirSync(join(store, dir), { recursive: true });
      symlinkSync(
        '../../node_modules/simplycms/skills/redesign-from-reference',
        join(store, dir, 'redesign-from-reference'),
      );
    }
    expect(checkSkillLinks({ storeRoot: store }).status).toBe('ok');
  });

  it('computeExitCode: error → 1, warn → 0, warn під --strict → 1', () => {
    const warn = [{ id: 'a', title: 'a', status: 'warn' as const }];
    const error = [{ id: 'b', title: 'b', status: 'error' as const }];
    expect(computeExitCode(error)).toBe(1);
    expect(computeExitCode(warn)).toBe(0);
    expect(computeExitCode(warn, { strict: true })).toBe(1);
  });

  it('parseDoctorArgs: --strict і --online приймаються, невідомий аргумент — помилка', () => {
    expect(parseDoctorArgs(['--strict'])).toEqual({
      strict: true,
      online: false,
    });
    expect(parseDoctorArgs([])).toEqual({ strict: false, online: false });
    expect(parseDoctorArgs(['--online'])).toEqual({
      strict: false,
      online: true,
    });
    expect(() => parseDoctorArgs(['--wat'])).toThrow(/--wat/);
  });

  // Без `--online` рядок про стан БД не зникає мовчки: окремий skip із
  // підказкою — інакше читач вирішить, що стан БД перевірено.
  it('без --online: рядок db-online = skip і називає --online', () => {
    const notice = offlineOnlyNotice();
    expect(notice.id).toBe('db-online');
    expect(notice.status).toBe('skip');
    expect(notice.details).toContain('--online');
    expect(computeExitCode([notice], { strict: true })).toBe(0);
  });
});

describe('cli doctor --online', () => {
  const URL_WITH_PASSWORD = 'postgresql://app_runtime:hunter2@db:5432/shop';
  const ctx = {
    storeRoot: '/store',
    env: { DATABASE_URL: URL_WITH_PASSWORD },
  };
  const files = [
    { name: '0001_init.sql', path: '/p', checksum: 'a' },
    { name: '0005_x.sql', path: '/p', checksum: 'b' },
  ];
  const row = (name: string, checksum: string) => ({
    name,
    checksum,
    appliedAt: new Date(),
  });
  const pendingMigrations = (
    rows: { name: string; checksum: string }[],
    list: typeof files,
  ) => {
    const done = new Map(rows.map((r) => [r.name, r.checksum]));
    return {
      pending: list.filter((f) => !done.has(f.name)).map((f) => f.name),
      changed: list
        .filter((f) => done.has(f.name) && done.get(f.name) !== f.checksum)
        .map((f) => f.name),
    };
  };
  const core = (journal: unknown) => ({
    listMigrationFiles: () => files,
    readJournal: async () => journal,
    pendingMigrations,
  });
  type Row = { id: string; status: string; details?: string };
  const byId = (checks: Row[]) =>
    Object.fromEntries(checks.map((c) => [c.id, c])) as Record<string, Row>;
  const reachable = async () => {};

  it('є ненакочені → migrations-journal = warn з іменем файлу', async () => {
    const checks = byId(
      await runOnlineChecks(ctx, {
        probe: reachable,
        core: core([row('0001_init.sql', 'a')]),
      }),
    );
    expect(checks['db-reachable']!.status).toBe('ok');
    expect(checks['migrations-journal']!.status).toBe('warn');
    expect(checks['migrations-journal']!.details).toContain('0005_x.sql');
  });

  it('усе накочено → ok', async () => {
    const checks = byId(
      await runOnlineChecks(ctx, {
        probe: reachable,
        core: core([row('0001_init.sql', 'a'), row('0005_x.sql', 'b')]),
      }),
    );
    expect(checks['migrations-journal']!.status).toBe('ok');
  });

  it('змінений накочений файл → error', async () => {
    const checks = byId(
      await runOnlineChecks(ctx, {
        probe: reachable,
        core: core([row('0001_init.sql', 'OTHER'), row('0005_x.sql', 'b')]),
      }),
    );
    expect(checks['migrations-journal']!.status).toBe('error');
    expect(checks['migrations-journal']!.details).toContain('0001_init.sql');
  });

  it('журналу немає (null) → error «база без журналу»', async () => {
    const checks = byId(
      await runOnlineChecks(ctx, { probe: reachable, core: core(null) }),
    );
    expect(checks['migrations-journal']!.status).toBe('error');
    expect(checks['migrations-journal']!.details).toContain('база без журналу');
  });

  it('БД недоступна → db-reachable = error без пароля, журнал = skip із причиною', async () => {
    const readJournal = vi.fn();
    const checks = byId(
      await runOnlineChecks(ctx, {
        probe: async () => {
          throw new Error(`connect ECONNREFUSED ${URL_WITH_PASSWORD}`);
        },
        core: { ...core([]), readJournal },
      }),
    );
    expect(checks['db-reachable']!.status).toBe('error');
    expect(checks['db-reachable']!.details).not.toContain('hunter2');
    expect(checks['migrations-journal']!.status).toBe('skip');
    expect(checks['migrations-journal']!.details).toContain('недоступна');
    expect(readJournal).not.toHaveBeenCalled();
  });

  it('помилка читання журналу → error без пароля', async () => {
    const checks = byId(
      await runOnlineChecks(ctx, {
        probe: reachable,
        core: {
          ...core([]),
          readJournal: async () => {
            throw new Error(`permission denied ${URL_WITH_PASSWORD}`);
          },
        },
      }),
    );
    expect(checks['migrations-journal']!.status).toBe('error');
    expect(checks['migrations-journal']!.details).not.toContain('hunter2');
  });

  it('без DATABASE_URL обидва онлайн-рядки = skip, зонд не кликано', async () => {
    const probe = vi.fn();
    const checks = byId(
      await runOnlineChecks({ storeRoot: '/store', env: {} }, { probe }),
    );
    expect(checks['db-reachable']!.status).toBe('skip');
    expect(checks['migrations-journal']!.status).toBe('skip');
    expect(probe).not.toHaveBeenCalled();
  });
});
