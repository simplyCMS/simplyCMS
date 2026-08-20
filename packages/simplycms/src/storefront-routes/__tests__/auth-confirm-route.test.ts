import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Серверний обробник `/auth/confirm` (спека 2026-08-03 §4.4).
 *
 * Invite-лист веде сюди з `token_hash`; `verifyOtp` на сервері ставить
 * auth-cookies і редиректить на `next`. Перевіряємо саме поведінку handler-а:
 * успішний verify, захист від open redirect і фолбек без токена.
 *
 * 🔴 Останній інваріант — файл роуту експортує ЛИШЕ `Route`. Named export
 * звідси переживає стрипінг властивості `server` і тягне серверний
 * Supabase-клієнт у клієнтський бандл; Gate C пілота ловив саме це.
 */

const verifyOtp = vi.fn();

vi.mock('simplycms/supabase/server-client', () => ({
  createServerSupabase: () => ({ auth: { verifyOtp } }),
}));

import * as routeModule from '../../../routes/storefront/auth/confirm';

type Handler = (ctx: { request: Request }) => Promise<Response>;

const handlers = routeModule.Route.options.server?.handlers as unknown as
  Record<string, Handler> | undefined;

/** Викликає GET-обробник із зібраним query-рядком. */
async function get(query: string): Promise<Response> {
  const handler = handlers?.GET;
  if (!handler) throw new Error('GET-обробник не зареєстровано');
  return handler({
    request: new Request(`http://shop.test/auth/confirm${query}`),
  });
}

describe('роут /auth/confirm', () => {
  beforeEach(() => {
    verifyOtp.mockReset();
    verifyOtp.mockResolvedValue({ error: null });
  });

  it('валідний token_hash+type → verifyOtp і 302 на next', async () => {
    const response = await get(
      '?token_hash=hash-1&type=invite&next=/auth/set-password',
    );

    expect(verifyOtp).toHaveBeenCalledWith({
      type: 'invite',
      token_hash: 'hash-1',
    });
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      'http://shop.test/auth/set-password',
    );
  });

  it('protocol-relative next відкидається на /', async () => {
    const response = await get(
      '?token_hash=hash-1&type=invite&next=//evil.com',
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('http://shop.test/');
  });

  it('без token_hash → редірект на /auth?error=auth_error', async () => {
    const response = await get('?type=invite');

    expect(verifyOtp).not.toHaveBeenCalled();
    expect(response.headers.get('location')).toBe(
      'http://shop.test/auth?error=auth_error',
    );
  });

  it('помилка verifyOtp → редірект на /auth?error=auth_error', async () => {
    verifyOtp.mockResolvedValue({ error: { message: 'expired' } });

    const response = await get('?token_hash=stale&type=invite&next=/admin');

    expect(response.headers.get('location')).toBe(
      'http://shop.test/auth?error=auth_error',
    );
  });

  it('файл роуту експортує лише Route — інакше серверний код тече в клієнт', () => {
    expect(Object.keys(routeModule)).toEqual(['Route']);
  });
});
