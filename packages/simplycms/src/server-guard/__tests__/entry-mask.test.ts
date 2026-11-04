import { notFound, redirect } from '@tanstack/react-router';
import { createServerEntry } from '@tanstack/react-start/server-entry';
import { describe, expect, it } from 'vitest';
import { parseMaskedErrorRef } from 'simplycms/contracts/masked-error';
import { httpErrorStatus, withEntryErrorMask } from '../entry-mask';

const PROD = { NODE_ENV: 'production' } as const;

/**
 * Поверх СПРАВЖНЬОГО `createServerEntry` Start, без моків: поведінка «Start сам
 * ловить виняток entry» і є причиною існування шару, мок її б приховав.
 */
function entryOf(thrower: () => unknown, env: Record<string, string> = PROD) {
  const lines: string[] = [];
  const entry = createServerEntry({
    fetch: withEntryErrorMask(
      () => {
        throw thrower();
      },
      { env, log: (line) => lines.push(line), newId: () => 'ab12cd34' },
    ),
  });
  return {
    lines,
    call: () => entry.fetch(new Request('http://store.test/')),
  };
}

describe('withEntryErrorMask поверх createServerEntry', () => {
  it('прод: звичайна помилка → 500 з ref, той самий id у лозі', async () => {
    const { call, lines } = entryOf(
      () => new Error('connect ECONNREFUSED 10.0.0.5:5432'),
    );
    const res = await call();
    const body = await res.text();

    expect(res.status).toBe(500);
    expect(parseMaskedErrorRef(body)).toBe('ab12cd34');
    expect(body).not.toContain('ECONNREFUSED');
    expect(lines.join('\n')).toContain('ab12cd34');
    expect(lines.join('\n')).toContain('ECONNREFUSED');
  });

  it('HTTP-помилка < 500 не маскується: Start відповідає її статусом', async () => {
    const { call, lines } = entryOf(() =>
      Object.assign(new Error('bad'), { status: 400 }),
    );
    const res = await call();

    expect(res.status).toBe(400);
    expect(lines).toEqual([]);
  });

  it('HTTP-помилка ≥ 500 маскується, статус зберігається', async () => {
    const { call } = entryOf(() =>
      Object.assign(new Error('db down'), { statusCode: 503 }),
    );
    const res = await call();

    expect(res.status).toBe(503);
    expect(parseMaskedErrorRef(await res.text())).toBe('ab12cd34');
  });

  it('кинутий Response віддається як є', async () => {
    const own = new Response('teapot', { status: 418 });
    const { call, lines } = entryOf(() => own);
    const res = await call();

    expect(res.status).toBe(418);
    expect(await res.text()).toBe('teapot');
    expect(lines).toEqual([]);
  });

  it('redirect і notFound проходять без маскування', async () => {
    const redirected = await entryOf(() => redirect({ to: '/cart' })).call();
    expect(redirected.status).toBeGreaterThanOrEqual(300);
    expect(redirected.status).toBeLessThan(400);
    expect(parseMaskedErrorRef(await redirected.text())).toBeNull();

    const missing = await entryOf(() => notFound()).call();
    expect(parseMaskedErrorRef(await missing.text())).toBeNull();
  });

  it('поза продом помилку не маскуємо (Start залогує сам)', async () => {
    const { call, lines } = entryOf(() => new Error('dev'), {});
    const res = await call();

    expect(res.status).toBe(500);
    expect(parseMaskedErrorRef(await res.text())).toBeNull();
    expect(lines).toEqual([]);
  });
});

describe('httpErrorStatus (дзеркало getErrorStatus upstream)', () => {
  it.each([
    [{ status: 404 }, 404],
    [{ statusCode: '413' }, 413],
    [{ cause: { status: 502 } }, 502],
    [{ status: 302 }, undefined],
    [{ status: 700 }, undefined],
    [{ status: 4.5 }, undefined],
    [new Error('x'), undefined],
    ['text', undefined],
  ])('%j → %s', (error, expected) => {
    expect(httpErrorStatus(error)).toBe(expected);
  });
});
