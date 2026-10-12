import { afterEach, describe, expect, it, vi } from 'vitest';

const S3_MARK = { kind: 's3' } as never;
const FS_MARK = { kind: 'local-fs' } as never;
const s3Driver = vi.hoisted(() => vi.fn());
const localFsDriver = vi.hoisted(() => vi.fn());
vi.mock('../s3', () => ({ s3Driver }));
vi.mock('../local-fs', () => ({ localFsDriver }));

import { selectMediaDriver } from '../select';

const S3_ENV = {
  S3_ENDPOINT: 'http://s3.test/',
  S3_REGION: 'garage',
  S3_BUCKET: 'bkt',
  S3_ACCESS_KEY: 'ak',
  S3_SECRET_KEY: 'sk',
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  s3Driver.mockReset();
  localFsDriver.mockReset();
});

async function fresh() {
  s3Driver.mockReturnValue(S3_MARK);
  localFsDriver.mockReturnValue(FS_MARK);
  return (await import('../select')).getMediaDriver;
}

describe('вибір драйвера сховища за env', () => {
  it('усі S3_* → драйвер s3 із розвʼязаною конфігурацією', async () => {
    for (const [k, v] of Object.entries(S3_ENV)) vi.stubEnv(k, v);
    const get = await fresh();
    expect(get()).toBe(S3_MARK);
    expect(s3Driver).toHaveBeenCalledWith(
      expect.objectContaining({ driver: 's3', endpoint: 'http://s3.test' }),
    );
    expect(localFsDriver).not.toHaveBeenCalled();
  });

  it('без S3_* → local-fs', async () => {
    for (const k of Object.keys(S3_ENV)) vi.stubEnv(k, '');
    const get = await fresh();
    expect(get()).toBe(FS_MARK);
    expect(s3Driver).not.toHaveBeenCalled();
  });

  it('часткова група S3_* → гучна помилка, а не мовчазний local-fs', async () => {
    for (const k of Object.keys(S3_ENV)) vi.stubEnv(k, '');
    vi.stubEnv('S3_ENDPOINT', 'http://s3.test');
    const get = await fresh();
    expect(() => get()).toThrow(/S3_REGION/);
    expect(localFsDriver).not.toHaveBeenCalled();
  });

  it('мемоізація: другий виклик не створює драйвер вдруге', async () => {
    for (const k of Object.keys(S3_ENV)) vi.stubEnv(k, '');
    const get = await fresh();
    expect(get()).toBe(get());
    expect(localFsDriver).toHaveBeenCalledTimes(1);
  });

  it('selectMediaDriver — чиста відповідність без кешу', () => {
    s3Driver.mockReturnValue(S3_MARK);
    expect(
      selectMediaDriver({
        driver: 's3',
        endpoint: 'e',
        region: 'r',
        bucket: 'b',
        accessKey: 'a',
        secretKey: 's',
      }),
    ).toBe(S3_MARK);
  });
});
