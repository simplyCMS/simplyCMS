import { notFound, redirect } from '@tanstack/react-router';
import { createServerEntry } from '@tanstack/react-start/server-entry';
import { describe, expect, it } from 'vitest';
import { parseMaskedErrorRef } from 'simplycms/contracts/masked-error';
import { HTTP_ERROR_STATUS_CASES } from '../../../../../tests/upstream-tripwires/httpErrorStatusCases';
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

  it('redirect (Response) проходить без маскування', async () => {
    const redirected = await entryOf(() => redirect({ to: '/cart' })).call();
    expect(redirected.status).toBeGreaterThanOrEqual(300);
    expect(redirected.status).toBeLessThan(400);
    expect(parseMaskedErrorRef(await redirected.text())).toBeNull();
  });

  // router-core `notFound()` — звичайний обʼєкт `{isNotFound:true}`, не Response:
  // `maskUnexpectedError` пропускає його як керування потоком, маска кидає далі, а
  // Start на рівні entry віддає на нього 500 JSON `unhandled` (+ `console.error`
  // без ref). У ланцюжку entry його ніхто не кидає (нормалізація має власний
  // `notFound(): Response`), тож поведінку не міняємо — фіксуємо фактичну.
  it('router-notFound — не Response: маска не чіпає, Start віддає свій 500', async () => {
    const { call, lines } = entryOf(() => notFound());
    const original = console.error;
    console.error = () => {};
    let res: Response;
    try {
      res = await call();
    } finally {
      console.error = original;
    }

    expect(res.status).toBe(500);
    expect(parseMaskedErrorRef(await res.text())).toBeNull();
    expect(lines).toEqual([]);
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
  // Та сама таблиця, що в розтяжці START-ENTRY-1: вона ж звіряє її зі справжнім Start.
  it.each(HTTP_ERROR_STATUS_CASES.map((c) => [c.name, c] as const))(
    '%s',
    (_name, c) => {
      const status = httpErrorStatus(c.make());
      // 200..399 і поза діапазоном — не HTTP-помилка; 400+ збігається зі статусом Start.
      expect(status).toBe(c.status);
    },
  );
});
