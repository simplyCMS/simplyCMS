import {
  appendFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  checkCoreVersions,
  checkEnv,
  runOfflineChecks,
} from '../packages/cli/src/doctor-checks.mjs';
import {
  checkHostDrift,
  checkMigrations,
} from '../packages/cli/src/doctor-fs-checks.mjs';
import { checkThemes } from '../packages/cli/src/doctor-theme-checks.mjs';
import {
  computeExitCode,
  hasSupabaseEnv,
  parseDoctorArgs,
} from '../packages/cli/src/doctor.mjs';
import { scaffold } from '../packages/create-simplycms-store/src/scaffold.mjs';

// Оффлайн-перевірки doctor на реальному скаффолді шаблону. Онлайн-перевірки
// (Supabase REST) тут не ганяються — мережі в тестах немає за контрактом.
const ENV = {
  VITE_SUPABASE_URL: 'https://x.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_pk',
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
    schemaMigrationsDir: join(
      storeRoot,
      'node_modules/simplycms/schema/migrations',
    ),
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

  it('checkEnv: без ключів — error; legacy anon-ключа достатньо', () => {
    expect(checkEnv({ env: {} }).status).toBe('error');
    const legacy = {
      VITE_SUPABASE_URL: 'https://x.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'eyJ',
    };
    expect(checkEnv({ env: legacy }).status).toBe('ok');
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
    const storeDir = join(store, 'supabase', 'migrations');
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

  it('computeExitCode: error → 1, warn → 0, warn під --strict → 1', () => {
    const warn = [{ id: 'a', title: 'a', status: 'warn' as const }];
    const error = [{ id: 'b', title: 'b', status: 'error' as const }];
    expect(computeExitCode(error)).toBe(1);
    expect(computeExitCode(warn)).toBe(0);
    expect(computeExitCode(warn, { strict: true })).toBe(1);
  });

  it('parseDoctorArgs: --strict приймається, невідомий аргумент — помилка', () => {
    expect(parseDoctorArgs(['--strict'])).toEqual({ strict: true });
    expect(parseDoctorArgs([])).toEqual({ strict: false });
    expect(() => parseDoctorArgs(['--wat'])).toThrow(/--wat/);
  });

  it('hasSupabaseEnv: потрібен URL і будь-який із двох ключів', () => {
    expect(hasSupabaseEnv(ENV)).toBe(true);
    expect(
      hasSupabaseEnv({ VITE_SUPABASE_URL: 'x', VITE_SUPABASE_ANON_KEY: 'k' }),
    ).toBe(true);
    expect(hasSupabaseEnv({ VITE_SUPABASE_PUBLISHABLE_KEY: 'k' })).toBe(false);
  });
});
