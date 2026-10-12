import { describe, expect, it } from 'vitest';
import {
  DriverEnvError,
  S3_KEYS,
  describeDriverEnv,
  resolveDriverEnv,
} from '../index';

// Значення — унікальні маркери: якщо вони потраплять у текст помилки чи опису,
// тест це побачить за підрядком.
const S3_FULL: Record<(typeof S3_KEYS)[number], string> = {
  S3_ENDPOINT: 'https://s3.example.test///',
  S3_REGION: 'REGION-7f3a',
  S3_BUCKET: 'BUCKET-7f3a',
  S3_ACCESS_KEY: 'ACCESS-7f3a',
  S3_SECRET_KEY: 'SECRET-7f3a',
};

function omit(
  env: Record<string, string>,
  key: string,
): Record<string, string> {
  return Object.fromEntries(Object.entries(env).filter(([k]) => k !== key));
}

function catchError(env: Record<string, string>): DriverEnvError {
  try {
    resolveDriverEnv(env);
  } catch (e) {
    expect(e).toBeInstanceOf(DriverEnvError);
    return e as DriverEnvError;
  }
  throw new Error('очікували DriverEnvError');
}

describe('resolveDriverEnv: значення за замовчуванням', () => {
  it('жодного ключа — local-fs без кореня й пошта log', () => {
    expect(resolveDriverEnv({})).toEqual({
      media: { driver: 'local-fs', root: null },
      mail: { driver: 'log' },
      warnings: [],
    });
  });

  it('MEDIA_ROOT задає корінь local-fs', () => {
    expect(resolveDriverEnv({ MEDIA_ROOT: '/data' }).media).toEqual({
      driver: 'local-fs',
      root: '/data',
    });
  });
});

describe('resolveDriverEnv: група S3', () => {
  it('усі п’ять ключів — s3, endpoint без хвостових слешів', () => {
    expect(resolveDriverEnv(S3_FULL).media).toEqual({
      driver: 's3',
      endpoint: 'https://s3.example.test',
      region: 'REGION-7f3a',
      bucket: 'BUCKET-7f3a',
      accessKey: 'ACCESS-7f3a',
      secretKey: 'SECRET-7f3a',
    });
  });

  it.each(S3_KEYS)('чотири з п’яти: без %s — помилка з цим ключем', (key) => {
    const rest = omit(S3_FULL, key);
    const error = catchError(rest);
    expect(error.group).toBe('s3');
    expect(error.missing).toEqual([key]);
    expect(error.message).toContain(key);
  });

  it('повідомлення помилки без значень (без значень ключів)', () => {
    const rest = omit(S3_FULL, 'S3_REGION');
    const { message } = catchError(rest);
    expect(message).not.toMatch(/7f3a/);
    expect(message).not.toContain('s3.example.test');
  });

  it('порожній рядок — незадано (Dokploy зберігає `KEY=`)', () => {
    const error = catchError({ ...S3_FULL, S3_REGION: '' });
    expect(error.missing).toEqual(['S3_REGION']);
  });

  it('усі S3_* порожні — це не часткова група, а local-fs', () => {
    const empty = Object.fromEntries(S3_KEYS.map((k) => [k, '']));
    expect(resolveDriverEnv(empty).media.driver).toBe('local-fs');
  });

  it('S3_* разом із MEDIA_ROOT — s3 і рівно одне попередження про MEDIA_ROOT', () => {
    const result = resolveDriverEnv({ ...S3_FULL, MEDIA_ROOT: '/data' });
    expect(result.media.driver).toBe('s3');
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('MEDIA_ROOT');
  });
});

describe('resolveDriverEnv: група SMTP', () => {
  it('SMTP_URL без MAIL_FROM — бракує MAIL_FROM', () => {
    const error = catchError({ SMTP_URL: 'smtps://u:p4ss@h:465' });
    expect(error.group).toBe('smtp');
    expect(error.missing).toEqual(['MAIL_FROM']);
    expect(error.message).not.toContain('p4ss');
  });

  it('MAIL_FROM без SMTP_URL — бракує SMTP_URL', () => {
    const error = catchError({ MAIL_FROM: 'shop@example.test' });
    expect(error.group).toBe('smtp');
    expect(error.missing).toEqual(['SMTP_URL']);
  });

  it('обидва ключі — smtp', () => {
    expect(
      resolveDriverEnv({
        SMTP_URL: 'smtps://u:p4ss@h:465',
        MAIL_FROM: 'shop@example.test',
      }).mail,
    ).toEqual({
      driver: 'smtp',
      url: 'smtps://u:p4ss@h:465',
      from: 'shop@example.test',
    });
  });
});

describe('describeDriverEnv', () => {
  it('s3 + log: бакет у тексті, без секретів', () => {
    const text = describeDriverEnv(resolveDriverEnv(S3_FULL));
    expect(text).toBe('медіа: s3 (бакет BUCKET-7f3a), пошта: log');
    expect(text).not.toMatch(/SECRET|ACCESS/);
  });

  it('SMTP_URL (логін і пароль) у тексті відсутній', () => {
    const text = describeDriverEnv(
      resolveDriverEnv({
        SMTP_URL: 'smtps://u:p4ss@h:465',
        MAIL_FROM: 'shop@example.test',
      }),
    );
    expect(text).toContain('smtp');
    expect(text).not.toContain('p4ss');
    expect(text).not.toContain('u:');
  });
});
