import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestHandler, setCookie } from '@tanstack/react-start/server';

/**
 * 🔴 Гард на спосіб побудови редіректу в auth-роутах `/auth/confirm`
 * і `/auth/callback`.
 *
 * `Response.redirect()` за специфікацією Fetch віддає Headers із guard
 * `immutable`. Start проганяє відповідь через `mergeEventResponseHeaders`
 * (`@tanstack/start-server-core`): для НЕ-ok відповіді (302 — саме така),
 * якщо в h3-евенті є set-cookie, він робить `response.headers.delete(...)`
 * і падає з TypeError → клієнт бачить 500 без auth-cookies. Тобто ламається
 * саме УСПІШНА гілка, де сесія вже виставлена.
 *
 * Попередній тест `auth-confirm-route.test.ts` кличе handler НАПРЯМУ,
 * повз `requestHandler`, тому цього класу дефекту не бачить. Тут handler
 * іде через СПРАВЖНІЙ `requestHandler`, а мок Supabase ставить cookie
 * тим самим `setCookie`, що й реальний `createServerSupabase`.
 */

const verifyOtp = vi.fn();
const exchangeCodeForSession = vi.fn();

vi.mock('@simplycms/supabase/server-client', () => ({
  createServerSupabase: () => ({
    auth: { verifyOtp, exchangeCodeForSession },
  }),
}));

import * as confirmModule from '../../routes/auth/confirm';
import * as callbackModule from '../../routes/auth/callback';

type Handler = (ctx: { request: Request }) => Promise<Response>;
type RouteModule = {
  Route: { options: { server?: { handlers?: unknown } } };
};

/** Дістає GET-обробник роуту з опцій createFileRoute. */
function getHandler(routeModule: RouteModule): Handler {
  const handlers = routeModule.Route.options.server?.handlers as
    Record<string, Handler> | undefined;
  const handler = handlers?.GET;
  if (!handler) throw new Error('GET-обробник не зареєстровано');
  return handler;
}

/**
 * Проганяє GET-обробник роуту через справжній `requestHandler` Start —
 * з ALS-контекстом h3-евента, тож `setCookie` всередині мока працює так
 * само, як у проді.
 */
async function runThroughStart(
  routeModule: RouteModule,
  url: string,
): Promise<Response> {
  const handler = getHandler(routeModule);
  const wrapped = requestHandler((request: Request) => handler({ request }));
  return wrapped(new Request(url), { context: {} });
}

/** Емулює побічний ефект Supabase: виставлення auth-cookie на сесію. */
function setAuthCookie(): void {
  setCookie('sb-shop-auth-token', 'session-1', { path: '/' });
}

describe('auth-редіректи переживають mergeEventResponseHeaders', () => {
  beforeEach(() => {
    verifyOtp.mockReset();
    exchangeCodeForSession.mockReset();
    verifyOtp.mockImplementation(async () => {
      setAuthCookie();
      return { error: null };
    });
    exchangeCodeForSession.mockImplementation(async () => {
      setAuthCookie();
      return { error: null };
    });
  });

  it('/auth/confirm: успішний verifyOtp → 302 з Location і set-cookie', async () => {
    const response = await runThroughStart(
      confirmModule as unknown as RouteModule,
      'http://shop.test/auth/confirm?token_hash=hash-1&type=invite&next=/auth/set-password',
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      'http://shop.test/auth/set-password',
    );
    expect(response.headers.getSetCookie()).toHaveLength(1);
    expect(response.headers.getSetCookie()[0]).toContain(
      'sb-shop-auth-token=session-1',
    );
  });

  it('/auth/callback: успішний exchangeCodeForSession → 302 з Location і set-cookie', async () => {
    const response = await runThroughStart(
      callbackModule as unknown as RouteModule,
      'http://shop.test/auth/callback?code=code-1&next=/admin',
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('http://shop.test/admin');
    expect(response.headers.getSetCookie()).toHaveLength(1);
    expect(response.headers.getSetCookie()[0]).toContain(
      'sb-shop-auth-token=session-1',
    );
  });

  // 🔴 `?next=` декодується `searchParams.get`, тож не-ASCII і CR/LF доходять
  // до заголовка сирими. `Headers` кидає на них TypeError — і це 500 ПІСЛЯ
  // спаленого одноразового OTP. Нормалізацію робить `new URL(...).href`
  // у `server/redirect.ts` (раніше її давав сам `Response.redirect`).
  it('/auth/confirm: кирилиця в next → 302 з percent-encoded Location', async () => {
    const response = await runThroughStart(
      confirmModule as unknown as RouteModule,
      'http://shop.test/auth/confirm?token_hash=hash-1&type=invite&next=%2F%D0%BA%D0%B0%D1%82%D0%B0%D0%BB%D0%BE%D0%B3',
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      'http://shop.test/%D0%BA%D0%B0%D1%82%D0%B0%D0%BB%D0%BE%D0%B3',
    );
    expect(response.headers.getSetCookie()).toHaveLength(1);
  });

  it('/auth/confirm: CR/LF у next не інжектить заголовка', async () => {
    const response = await runThroughStart(
      confirmModule as unknown as RouteModule,
      'http://shop.test/auth/confirm?token_hash=hash-1&type=invite&next=%2Fx%0D%0AX-Injected%3A%201',
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('x-injected')).toBeNull();
    expect(response.headers.get('location')).not.toContain('\n');
  });

  it('/auth/confirm: помилка verifyOtp → 302 на /auth?error=auth_error', async () => {
    verifyOtp.mockResolvedValue({ error: { message: 'expired' } });

    const response = await runThroughStart(
      confirmModule as unknown as RouteModule,
      'http://shop.test/auth/confirm?token_hash=stale&type=invite',
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      'http://shop.test/auth?error=auth_error',
    );
  });
});
