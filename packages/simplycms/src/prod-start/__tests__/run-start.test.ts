import { describe, expect, it, vi } from 'vitest';
import { runStart } from '../run-start';

// Юніт ядра прод-старту на фейках: перевіряємо ПОРЯДОК кроків і те, що
// пароль власника схеми не доходить ні до execve, ні до виводу. Справжній
// накат + execve доводять start-migrate.test.ts (test:schema), шим —
// tests/start-script.test.ts, процес у проді — Gate B пілота (/proc/<pid>/environ).
// Парність STRIPPED_ENV із server.mjs — tests/stripped-env-parity.test.ts.

const OWNER_URL = 'postgres://owner:s3cr3t-Pa55@db:5432/shop';
const baseEnv = {
  DATABASE_URL: 'postgres://app_runtime:rt@db:5432/shop',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  VITE_SITE_URL: 'https://shop.test',
  PATH: '/usr/bin',
};

function setup(overrides: Record<string, unknown> = {}) {
  const logs: string[] = [];
  const migrate = vi.fn(async (options: { log: (message: string) => void }) => {
    void options;
    return { applied: ['0005_x.sql'] };
  });
  const execve = vi.fn((file: string, args: string[], env: unknown) => {
    void [file, args, env];
  });
  const resolveDriverEnv = vi.fn(() => ({ warnings: [] as string[] }));
  const deps = {
    env: { ...baseEnv, MIGRATION_DATABASE_URL: OWNER_URL } as Record<
      string,
      string
    >,
    cwd: '/srv/shop',
    migrate,
    resolveDriverEnv,
    readPrimaryLocale: () => 'uk' as string | null,
    execve,
    log: (message: string) => logs.push(message),
    execPath: '/usr/bin/node',
    ...overrides,
  };
  return { deps, logs, migrate, execve, resolveDriverEnv };
}

describe('runStart', () => {
  it('часткова група → код 1, ні накату, ні execve', async () => {
    const { deps, logs, migrate, execve } = setup({
      resolveDriverEnv: () => {
        throw new Error('[simplycms/env] Група S3 задана не повністю');
      },
    });
    expect(await runStart(deps)).toBe(1);
    expect(migrate).not.toHaveBeenCalled();
    expect(execve).not.toHaveBeenCalled();
    expect(logs.join('\n')).toContain('Група S3');
  });

  it('є MIGRATION_DATABASE_URL → накат з runtimeUrl = DATABASE_URL, execve без змінної', async () => {
    const { deps, migrate, execve } = setup();
    await runStart(deps);
    expect(migrate).toHaveBeenCalledOnce();
    expect(migrate.mock.calls[0][0]).toMatchObject({
      connectionString: OWNER_URL,
      dir: '/srv/shop/db/migrations',
      runtimeUrl: baseEnv.DATABASE_URL,
      primaryLocale: 'uk',
    });
    expect(execve).toHaveBeenCalledOnce();
    const [file, args, env] = execve.mock.calls[0];
    expect(file).toBe('/usr/bin/node');
    expect(args).toEqual(['/usr/bin/node', '/srv/shop/server.mjs']);
    expect(env).toEqual(baseEnv);
    expect(env).not.toHaveProperty('MIGRATION_DATABASE_URL');
  });

  it('є MIGRATION_DATABASE_URL, але в конфігу немає primaryLocale → код 1 до накату, execve немає', async () => {
    const { deps, logs, migrate, execve } = setup({
      readPrimaryLocale: () => null,
    });
    expect(await runStart(deps)).toBe(1);
    expect(migrate).not.toHaveBeenCalled();
    expect(execve).not.toHaveBeenCalled();
    expect(logs.join('\n')).toContain("primaryLocale: '<код>'");
  });

  it('конфіг не прочитано (ENOENT) → код 1 з назвою файлу й причиною, не «немає мітки»', async () => {
    const { deps, logs, migrate, execve } = setup({
      readPrimaryLocale: () => {
        throw new Error(
          "ENOENT: no such file, open '/srv/shop/simplycms.config.ts'",
        );
      },
    });
    expect(await runStart(deps)).toBe(1);
    expect(migrate).not.toHaveBeenCalled();
    expect(execve).not.toHaveBeenCalled();
    const out = logs.join('\n');
    expect(out).toContain('simplycms.config.ts');
    expect(out).toContain('ENOENT');
    expect(out).not.toContain('Додайте основну мову');
  });

  it('змінної немає → накату немає, execve є, мова не потрібна', async () => {
    const { deps, migrate, execve } = setup({
      env: { ...baseEnv },
      readPrimaryLocale: () => null,
    });
    await runStart(deps);
    expect(migrate).not.toHaveBeenCalled();
    expect(execve).toHaveBeenCalledOnce();
  });

  it('накат упав → код 1, execve немає, пароль власника у виводі відсутній', async () => {
    const { deps, logs, execve } = setup({
      migrate: vi.fn(async () => {
        throw new Error(`connect failed: ${OWNER_URL} (pass s3cr3t-Pa55)`);
      }),
    });
    expect(await runStart(deps)).toBe(1);
    expect(execve).not.toHaveBeenCalled();
    expect(logs.join('\n')).not.toContain('s3cr3t-Pa55');
  });

  it('лог накату теж очищається від пароля', async () => {
    const { deps, logs } = setup({
      migrate: vi.fn(async (o: { log: (m: string) => void }) => {
        o.log('з’єднання s3cr3t-Pa55');
        return { applied: [] };
      }),
    });
    await runStart(deps);
    expect(logs.join('\n')).not.toContain('s3cr3t-Pa55');
  });

  it('execve кинув (EPERM) → код 1, повідомлення без оточення й секретів', async () => {
    const { deps, logs } = setup({
      execve: vi.fn(() => {
        throw Object.assign(new Error(`EPERM ${OWNER_URL}`), { code: 'EPERM' });
      }),
    });
    expect(await runStart(deps)).toBe(1);
    const out = logs.join('\n');
    expect(out).toContain('EPERM');
    expect(out).not.toContain('s3cr3t-Pa55');
  });

  it('execve кинув помилку з порожнім code → у лозі немає «(undefined)»', async () => {
    const { deps, logs } = setup({
      execve: vi.fn(() => {
        throw Object.assign(new Error('boom'), { code: undefined });
      }),
    });
    expect(await runStart(deps)).toBe(1);
    expect(logs.join('\n')).not.toContain('undefined');
  });

  it('нічого накочувати → окремий рядок у лозі', async () => {
    const { deps, logs } = setup({
      migrate: vi.fn(async () => ({ applied: [] })),
    });
    await runStart(deps);
    expect(logs.join('\n')).toContain('нічого накочувати');
  });

  it('БД засіяно основною мовою → рядок про засів, без «нічого накочувати»', async () => {
    const { deps, logs } = setup({
      migrate: vi.fn(async () => ({ applied: [], bootstrapped: true })),
    });
    await runStart(deps);
    expect(logs.join('\n')).toContain('засіяно основну мову');
    expect(logs.join('\n')).not.toContain('нічого накочувати');
  });

  it('без process.execve → код 1 і пояснення про Node ≥ 24', async () => {
    const { deps, logs, migrate } = setup({ execve: undefined });
    expect(await runStart(deps)).toBe(1);
    expect(migrate).not.toHaveBeenCalled();
    expect(logs.join('\n')).toContain('Node ≥ 24');
  });
});
