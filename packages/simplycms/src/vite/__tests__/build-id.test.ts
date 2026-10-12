import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const execSync = vi.fn();
vi.mock('node:child_process', () => ({ execSync }));

// Мемо живе на рівні модуля — кожен кейс бере свіжий екземпляр.
async function fresh() {
  vi.resetModules();
  return (await import('../build-id')).resolveBuildId;
}

const build = { command: 'build', cwd: '/store' };

describe('resolveBuildId', () => {
  let saved: string | undefined;
  beforeEach(() => {
    saved = process.env.BUILD_ID;
    delete process.env.BUILD_ID;
    execSync.mockReset();
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.BUILD_ID;
    else process.env.BUILD_ID = saved;
  });

  it('явний BUILD_ID виграє, git не кличеться', async () => {
    const resolve = await fresh();
    expect(resolve({ BUILD_ID: 'e8-abc', SOURCE_COMMIT: 'zzz' }, build)).toBe(
      'e8-abc',
    );
    expect(execSync).not.toHaveBeenCalled();
  });

  it('SOURCE_COMMIT — перші 12 символів', async () => {
    const resolve = await fresh();
    expect(resolve({ SOURCE_COMMIT: '0123456789abcdef0123' }, build)).toBe(
      '0123456789ab',
    );
  });

  it('без env у build — git rev-parse у cwd магазину', async () => {
    execSync.mockReturnValue(Buffer.from('a1b2c3d\n'));
    const resolve = await fresh();
    expect(resolve({}, build)).toBe('a1b2c3d');
    expect(execSync).toHaveBeenCalledWith(
      'git rev-parse --short HEAD',
      expect.objectContaining({ cwd: '/store' }),
    );
  });

  it('git недоступний — час збірки в base36', async () => {
    execSync.mockImplementation(() => {
      throw new Error('not a git repository');
    });
    const resolve = await fresh();
    expect(resolve({}, build)).toMatch(/^t[0-9a-z]+$/);
  });

  it('у dev — "dev", без git і без запису в process.env', async () => {
    const resolve = await fresh();
    expect(
      resolve({ BUILD_ID: 'ignored' }, { command: 'serve', cwd: '/store' }),
    ).toBe('dev');
    expect(execSync).not.toHaveBeenCalled();
    expect(process.env.BUILD_ID).toBeUndefined();
  });

  it('мемоізація: другий виклик дає те саме й пише в process.env.BUILD_ID', async () => {
    execSync.mockImplementation(() => {
      throw new Error('no git');
    });
    const resolve = await fresh();
    const first = resolve({}, build);
    // Інший Date.now() не має змінити id між SSR- і клієнтським проходами.
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 10_000);
    expect(resolve({}, build)).toBe(first);
    vi.useRealTimers();
    expect(process.env.BUILD_ID).toBe(first);
  });
});
