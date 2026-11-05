import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  harnessContainerName,
  harnessMailEnv,
  liveHarnessFile,
} from '../scripts/harness-env.mjs';

// Порожня тека без `.env.harness`: CI-job schema файлу не має, ключі йдуть лише з env.
const KEYS = [
  'SMTP_URL',
  'HARNESS_SMTP_URL',
  'HARNESS_MAILPIT_URL',
  'MAIL_FROM',
] as const;

describe('harnessMailEnv: ключі CI-job-а доходять без .env.harness (Р31)', () => {
  const saved: Record<string, string | undefined> = {};
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'harness-env-'));
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    rmSync(root, { recursive: true, force: true });
  });

  it('HARNESS_SMTP_URL з env → SMTP_URL проєкту mail', () => {
    process.env.HARNESS_SMTP_URL = 'smtp://localhost:54325';
    process.env.HARNESS_MAILPIT_URL = 'http://localhost:54326';
    expect(harnessMailEnv(root)).toEqual({
      SMTP_URL: 'smtp://localhost:54325',
      MAIL_FROM: 'shop@harness.test',
      HARNESS_MAILPIT_URL: 'http://localhost:54326',
    });
  });

  it('явний SMTP_URL має пріоритет над HARNESS_SMTP_URL', () => {
    process.env.SMTP_URL = 'smtp://explicit:1';
    process.env.HARNESS_SMTP_URL = 'smtp://localhost:54325';
    expect(harnessMailEnv(root).SMTP_URL).toBe('smtp://explicit:1');
  });

  it('без жодного джерела SMTP_URL не з’являється', () => {
    expect(harnessMailEnv(root)).not.toHaveProperty('SMTP_URL');
  });
});

describe('harnessContainerName: стенд другого дерева', () => {
  it('без префікса й файла → дефолтний контейнер', () => {
    expect(harnessContainerName({}, null)).toBe('simplycms-harness-pg');
  });
  it('HARNESS_PREFIX з оточення → контейнер дерева', () => {
    expect(harnessContainerName({ HARNESS_PREFIX: 'm2b-a' }, null)).toBe(
      'm2b-a-pg',
    );
  });
  it('імʼя з .env.harness має пріоритет над префіксом', () => {
    expect(
      harnessContainerName(
        { HARNESS_PREFIX: 'інший' },
        { HARNESS_PG_CONTAINER: 'm2b-a-pg' },
      ),
    ).toBe('m2b-a-pg');
  });
});

describe('liveHarnessFile: файл дерева звіряється з його контейнером', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'harness-file-'));
    writeFileSync(
      join(root, '.env.harness'),
      'HARNESS_PG_CONTAINER=m2b-a-pg\nPG_HARNESS_URL=postgres://x@localhost:54431/postgres\n',
    );
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('запущено лише m2b-a-pg → файл підхоплено, дефолтний контейнер не питали', () => {
    const running = vi.fn((name: string) => name === 'm2b-a-pg');
    expect(liveHarnessFile(root, running)?.PG_HARNESS_URL).toBe(
      'postgres://x@localhost:54431/postgres',
    );
    expect(running.mock.calls).toEqual([['m2b-a-pg']]);
  });

  it('контейнер дерева не запущено → файл ігноровано', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(liveHarnessFile(root, () => false)).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('m2b-a-pg'));
    warn.mockRestore();
  });
});
