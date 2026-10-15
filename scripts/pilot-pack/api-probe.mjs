/**
 * Оверлей ПІЛОТА для `/api/v1`: сервісний обліковий запис із роллю admin і токеном відомого
 * вигляду, щоб Gate B міг викликати HTTP-API скафолдженого магазину (М1 «читається обома
 * транспортами»). Накатує лише `apply-probe.mjs`; ні демо-сід, ні пакети, ні шаблон цього
 * не несуть (стереже `tests/pilot-probe-not-packed.test.ts`).
 *
 * Токен — формат майстра §3.3: `scms_<8 hex>_<32 байти base64url>`; у БД лежить sha256 від
 * УСЬОГО рядка (`token_hash`), тож гейт знає відкритий текст, а магазин — лише хеш.
 * Сервісний запис — це `users` + `service_accounts` без `accounts` (тригери SC002/SC003);
 * `languages` не чіпаємо, тож замок `languages-set` не потрібен.
 */
import { createHash } from 'node:crypto';

export const PROBE_TOKEN =
  'scms_c0ffee00_pilotApiProbeTokenAAAAAAAAAAAAAAAAAAAAAAAAA';
const USER_ID = '00000000-0000-4000-8000-0000000a91f0';
const TOKEN_ID = '00000000-0000-4000-8000-0000000a91f1';
/** Операції, на які видано токен: `api-tokens.list` — щоб 403 дав саме `sessionOnly`, а не scope. */
export const PROBE_SCOPES = ['languages.list', 'api-tokens.list'];

/** @param {import('pg').Client} client підключення під адміністративним DSN */
export async function applyApiProbe(client) {
  await client.query('begin');
  try {
    await client.query(
      `insert into public.users (id, name, email, email_verified)
       values ($1, 'Pilot API probe', 'pilot-api-probe@simplycms.test', true)
       on conflict (id) do nothing`,
      [USER_ID],
    );
    await client.query(
      `insert into public.service_accounts (user_id) values ($1)
       on conflict (user_id) do nothing`,
      [USER_ID],
    );
    await client.query(
      `insert into public.user_roles (id, user_id, role)
       values ($1, $2, 'admin') on conflict (user_id, role) do nothing`,
      ['00000000-0000-4000-8000-0000000a91f2', USER_ID],
    );
    await client.query(
      `insert into public.api_tokens (id, user_id, name, token_prefix, token_hash, scopes)
       values ($1, $2, 'pilot-probe', $3, $4, $5)
       on conflict (id) do nothing`,
      [
        TOKEN_ID,
        USER_ID,
        PROBE_TOKEN.slice(5, 13),
        createHash('sha256').update(PROBE_TOKEN).digest(),
        PROBE_SCOPES,
      ],
    );
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  }
}
