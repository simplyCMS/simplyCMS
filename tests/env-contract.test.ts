import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Пін контракту env магазину (К2-Е0, Е0-7): три документи (.env.example,
 * doctor, CLAUDE.md) уже розходились — карта стану показувала чотири ключі.
 * Машинно перевіряються два з них; CLAUDE.md — прозою, з посиланням сюди.
 */
const ROOT = resolve(import.meta.dirname, '..');
const CONTRACT = [
  'DATABASE_URL',
  'BETTER_AUTH_SECRET',
  'VITE_SITE_URL',
] as const;
const SERVER_ONLY = ['DATABASE_URL', 'BETTER_AUTH_SECRET'] as const;

/**
 * Опційні ключі: працюють, якщо задані, але магазин без них стартує.
 * 🔴 Присутні в `.env.example` РІВНО коментарем — активний рядок зробив би
 * їх частиною контракту (тест `активні ключі — рівно контракт` червонів би),
 * а відсутність позбавила б магазин єдиної документації про них.
 */
const OPTIONAL = ['BETTER_AUTH_URL', 'MEDIA_ROOT'] as const;

describe('контракт env магазину', () => {
  it('.env.example: активні ключі — рівно контракт', () => {
    const active = readFileSync(resolve(ROOT, '.env.example'), 'utf8')
      .split('\n')
      .filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => line.split('=')[0]);
    expect(active.sort()).toEqual([...CONTRACT].sort());
  });

  it('doctor вимагає рівно серверну підмножину контракту', () => {
    const src = readFileSync(
      resolve(ROOT, 'packages/cli/src/doctor-checks.mjs'),
      'utf8',
    );
    const m = /const REQUIRED_ENV_VARS = \[([^\]]*)\]/.exec(src);
    expect(m, 'REQUIRED_ENV_VARS не знайдено').not.toBeNull();
    const required = m![1]
      .split(',')
      .map((s) => s.trim().replace(/['"]/g, ''))
      .filter(Boolean);
    expect(required.sort()).toEqual([...SERVER_ONLY].sort());
  });

  it.each(OPTIONAL)('%s — присутній коментарем і НЕ активним ключем', (key) => {
    const example = readFileSync(resolve(ROOT, '.env.example'), 'utf8');
    expect(example, `${key} не задокументовано`).toMatch(
      new RegExp(`^# ${key}=`, 'm'),
    );
    expect(example).not.toMatch(new RegExp(`^${key}=`, 'm'));
  });

  it('BETTER_AUTH_URL пояснює наслідок жорсткого origin', () => {
    const example = readFileSync(resolve(ROOT, '.env.example'), 'utf8');
    expect(example).toMatch(/INVALID_ORIGIN/);
  });

  it('MEDIA_ROOT пояснює, чому дефолт не годиться для прода', () => {
    const example = readFileSync(resolve(ROOT, '.env.example'), 'utf8');
    expect(example).toMatch(/mounted volume/);
  });

  it('шаблон магазину документує ті самі опційні ключі', () => {
    const template = readFileSync(
      resolve(ROOT, 'packages/create-simplycms-store/template/env.example'),
      'utf8',
    );
    for (const key of OPTIONAL) {
      expect(template, `${key} відсутній у шаблоні`).toMatch(
        new RegExp(`^# ${key}=`, 'm'),
      );
    }
  });
});
