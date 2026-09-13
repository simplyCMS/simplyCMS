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

  it('BETTER_AUTH_URL — опційний і задокументований як такий', () => {
    const example = readFileSync(resolve(ROOT, '.env.example'), 'utf8');
    expect(example).toMatch(/^# BETTER_AUTH_URL=/m);
    expect(example).toMatch(/INVALID_ORIGIN/);
  });
});
