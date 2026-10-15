import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { harnessMailEnv } from '../scripts/harness-env.mjs';

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
