import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { csrfMiddleware } from 'simplycms/runtime/csrf';
import { startInstance } from '../src/start';
import { toRequestUrl } from '../server-runtime.mjs';

/**
 * CSRF-міддлвара Start (тема 2 спеки deps-security-tooling).
 *
 * 🔴 Start вмикає дефолтний захист лише БЕЗ `startInstance`; у нас він є, тож
 * без `csrfMiddleware` у `requestMiddleware` server functions відкриті.
 * Тут: (1) поведінка самої міддлвари — викликаємо її серверну функцію напряму
 * (`middleware.options.server`), як це робить рантайм Start; (2) ПРОВОДКА —
 * що `src/start.ts` справді підключає її першою, а дві інші копії
 * `start.ts` (канон CLI і шаблон) — так само. Мутація «прибрати
 * csrfMiddleware зі start.ts» червоніє саме на (2) і на cross-site-кейсі
 * наскрізного блоку.
 */

const NEXT = Symbol('next');

type ServerFn = (ctx: {
  request: Request;
  next: () => unknown;
}) => Promise<unknown>;

async function run(
  middleware: unknown,
  request: Request,
): Promise<'next' | Response> {
  const server = (middleware as { options: { server: ServerFn } }).options
    .server;
  const result = await server({ request, next: () => NEXT });
  return result === NEXT ? 'next' : (result as Response);
}

const BASE = 'http://shop.test';
const post = (path: string, headers: Record<string, string> = {}) =>
  new Request(`${BASE}${path}`, { method: 'POST', headers, body: '{}' });

describe('csrfMiddleware — поведінка', () => {
  it('same-origin (Sec-Fetch-Site) проходить', async () => {
    const r = await run(
      csrfMiddleware,
      post('/_serverFn/x', { 'sec-fetch-site': 'same-origin' }),
    );
    expect(r).toBe('next');
  });

  it('Sec-Fetch-Site: cross-site → 403', async () => {
    const r = await run(
      csrfMiddleware,
      post('/_serverFn/x', { 'sec-fetch-site': 'cross-site' }),
    );
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).status).toBe(403);
  });

  it('чужий Origin без Sec-Fetch-Site → 403', async () => {
    const r = await run(
      csrfMiddleware,
      post('/_serverFn/x', { origin: 'https://evil.example' }),
    );
    expect((r as Response).status).toBe(403);
  });

  it('свій Origin без Sec-Fetch-Site проходить', async () => {
    const r = await run(csrfMiddleware, post('/_serverFn/x', { origin: BASE }));
    expect(r).toBe('next');
  });

  it('жодного заголовка → 403', async () => {
    const r = await run(csrfMiddleware, post('/_serverFn/x'));
    expect((r as Response).status).toBe(403);
  });

  it('server route (не server function) теж під захистом', async () => {
    const r = await run(
      csrfMiddleware,
      post('/api/health', { origin: 'https://evil.example' }),
    );
    expect((r as Response).status).toBe(403);
  });

  it('за проксі: origin із x-forwarded-* збігається з Origin публічного домену', async () => {
    const url = toRequestUrl({
      url: '/_serverFn/x',
      headers: {
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'shop.example.com',
        host: 'internal:3000',
      },
    });
    const ok = await run(
      csrfMiddleware,
      new Request(url, {
        method: 'POST',
        headers: { origin: 'https://shop.example.com' },
        body: '{}',
      }),
    );
    expect(ok).toBe('next');

    // Origin внутрішнього хоста за проксі — не збігається з публічним.
    const bad = await run(
      csrfMiddleware,
      new Request(url, {
        method: 'POST',
        headers: { origin: 'http://internal:3000' },
        body: '{}',
      }),
    );
    expect((bad as Response).status).toBe(403);
  });

  it('POST на /api/auth/* не перевіряється (без заголовків і cross-site)', async () => {
    expect(await run(csrfMiddleware, post('/api/auth/sign-in/email'))).toBe(
      'next',
    );
    expect(
      await run(
        csrfMiddleware,
        post('/api/auth/sign-in/email', { 'sec-fetch-site': 'cross-site' }),
      ),
    ).toBe('next');
  });

  it('GET без заголовків не перевіряється', async () => {
    const r = await run(csrfMiddleware, new Request(`${BASE}/anything`));
    expect(r).toBe('next');
  });
});

describe('проводка csrfMiddleware у start.ts', () => {
  it('startInstance: csrfMiddleware — ПЕРШИЙ у requestMiddleware', async () => {
    const options = await startInstance.getOptions();
    expect(options.requestMiddleware?.[0]).toBe(csrfMiddleware);
    expect(options.requestMiddleware).toHaveLength(2);
  });

  it('наскрізно: першою міддлварою startInstance cross-site POST блокується', async () => {
    const options = await startInstance.getOptions();
    const first = options.requestMiddleware?.[0];
    expect(first).toBeDefined();
    const r = await run(
      first,
      post('/_serverFn/x', { 'sec-fetch-site': 'cross-site' }),
    );
    expect((r as Response).status).toBe(403);
  });

  it.each([
    'src/start.ts',
    'packages/cli/host/src/start.ts',
    'packages/create-simplycms-store/template/src/start.ts',
  ])('%s: CSRF перед adminRequestGuard', (file) => {
    const src = readFileSync(resolve(__dirname, '..', file), 'utf8');
    expect(src).toContain(
      "import { csrfMiddleware } from 'simplycms/runtime/csrf';",
    );
    expect(src).toContain(
      'requestMiddleware: [csrfMiddleware, adminRequestGuard]',
    );
  });
});
