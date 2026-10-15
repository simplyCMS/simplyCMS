import { notFound, redirect } from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';
import { DOMAIN_ERROR_NAME } from 'simplycms/contracts/domain-errors';
import { parseMaskedErrorRef } from 'simplycms/contracts/masked-error';
import { maskUnexpectedError } from '../mask-errors';

const PROD = { NODE_ENV: 'production' } as const;

/** Помилка в формі, яку віддає Drizzle: SQL з параметрами в message, pg-помилка в cause. */
function drizzleError(): Error {
  const driver = new Error(
    'connect ECONNREFUSED 10.0.0.5:5432 (postgres://app:s3cr3t@10.0.0.5:5432/shop)',
  );
  return new Error(
    'Failed query: select "id" from "products" where "slug" = $1\nparams: not-a-uuid',
    { cause: driver },
  );
}

function run(error: unknown, env: Record<string, string> = PROD) {
  const lines: string[] = [];
  const result = maskUnexpectedError(error, {
    env,
    log: (line) => lines.push(line),
    newId: () => 'ab12cd34',
  });
  return { result, log: lines.join('\n') };
}

describe('maskUnexpectedError (Р23)', () => {
  it('прод: клієнт отримує лише загальний текст і ідентифікатор', () => {
    const { result } = run(drizzleError());

    expect(result).toBeInstanceOf(Error);
    const text = (result as Error).message;
    expect(text).toBe('Internal server error [ref ab12cd34]');
    expect(parseMaskedErrorRef(text)).toBe('ab12cd34');
    for (const leak of ['select', 'params', 'Failed query', 'ECONNREFUSED']) {
      expect(text).not.toContain(leak);
    }
  });

  it('прод: у лозі є той самий ідентифікатор, повний текст і ланцюжок cause', () => {
    const { log } = run(drizzleError());

    expect(log).toContain('ab12cd34');
    expect(log).toContain('Failed query');
    expect(log).toContain('ECONNREFUSED 10.0.0.5:5432');
  });

  it('прод: облікові дані з рядка підключення в лозі замасковані', () => {
    const { log } = run(drizzleError());

    expect(log).not.toContain('s3cr3t');
    expect(log).toContain('postgres://***@10.0.0.5');
  });

  it('прод: кинуте не-Error (рядок) теж маскується', () => {
    const { result, log } = run('SELECT secret FROM users');

    expect((result as Error).message).toBe(
      'Internal server error [ref ab12cd34]',
    );
    expect(log).toContain('SELECT secret FROM users');
  });

  it('поза продом — як є, без логу', () => {
    const error = drizzleError();
    const { result, log } = run(error, { NODE_ENV: 'development' });

    expect(result).toBe(error);
    expect(log).toBe('');
  });

  it('уся родина доменних помилок проходить як є (за членством у DOMAIN_ERROR_NAME)', () => {
    for (const name of Object.values(DOMAIN_ERROR_NAME)) {
      const error = Object.assign(new Error('для людини'), { name });
      const { result, log } = run(error);
      expect(result).toBe(error);
      expect(log).toBe('');
    }
  });

  it('керування потоком Start проходить як є: redirect, notFound, Response', () => {
    for (const passThrough of [
      redirect({ to: '/auth' }),
      notFound(),
      new Response('x', { status: 418 }),
    ]) {
      const { result, log } = run(passThrough);
      expect(result).toBe(passThrough);
      expect(log).toBe('');
    }
  });

  it('вже замаскована помилка не отримує другого ідентифікатора й запису в лозі', () => {
    const first = run(drizzleError()).result;
    const again = run(first);

    expect(again.result).toBe(first);
    expect(again.log).toBe('');
  });
});
