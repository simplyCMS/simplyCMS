import { maskUnexpectedError, type MaskOptions } from './mask-errors';

/**
 * UPSTREAM:START-ENTRY-1 — див. docs/architecture/upstream-workarounds.md.
 *
 * `createServerEntry` Start (start-server-core ≥ 1.169.45) сам ловить виняток
 * нашого entry й віддає `{"status":500,"unhandled":true,"message":"HTTPError"}`
 * (`handleStartError` → `createErrorResponse`): помилка поза роутером
 * (`loadLocaleSet` у нормалізації, мертва БД) не доходить до `catch` у
 * `server.mjs`, тож без цього шару вона лишається без ref: Start лише
 * `console.error`-ить її без id, рядок у лозі не зіставити з відповіддю, а
 * клієнт бачить німий JSON.
 */

/**
 * Статус «HTTP-помилки» — дзеркало `getErrorStatus` + `getHttpErrorStatus`
 * upstream (`internal-request-response.js`): `status`/`statusCode` на помилці
 * або на її `cause`, число чи числовий рядок, ціле 200..599, помилкою вважається
 * від 400. Власної ознаки не вигадуємо: Start відповідає саме за нею, тож шар
 * мусить пропускати те саме, що Start обробляє як задумано (400/404/413…).
 */
export function httpErrorStatus(error: unknown): number | undefined {
  const read = (value: unknown, key: string): number | string | undefined => {
    if (typeof value !== 'object' || value === null) return undefined;
    const property = (value as Record<string, unknown>)[key];
    return typeof property === 'string' || typeof property === 'number'
      ? property
      : undefined;
  };
  const cause =
    typeof error === 'object' && error !== null
      ? (error as { cause?: unknown }).cause
      : undefined;
  const raw =
    read(error, 'status') ??
    read(error, 'statusCode') ??
    read(cause, 'status') ??
    read(cause, 'statusCode');
  const code = typeof raw === 'string' ? Number(raw) : raw;
  if (code === undefined || !Number.isInteger(code)) return undefined;
  if (code < 200 || code > 599) return undefined;
  return code >= 400 ? code : undefined;
}

type FetchHandler<A extends unknown[]> = (
  request: Request,
  ...rest: A
) => Response | Promise<Response>;

/**
 * Маска винятків серверного входу (Р23 для шляху поза роутером). Ловить те, що
 * кинув `fetch` entry:
 *  - HTTP-помилка зі статусом < 500 і кинутий `Response` (redirect) — кидаємо
 *    далі: Start відповість як задумано. Router-`notFound()` — не `Response`, а
 *    звичайний обʼєкт: `maskUnexpectedError` його пропускає, Start віддає 500
 *    `unhandled` без ref (у ланцюжку entry його ніхто не кидає);
 *  - решта в проді — через `maskUnexpectedError` (ТОЙ САМИЙ шлях, що в масці
 *    server functions: один формат логу, `redactUrls`, `Internal server error
 *    [ref <id>]`); статус ≥ 500 з помилки зберігається, інакше 500;
 *  - поза продом `maskUnexpectedError` повертає помилку як є — кидаємо далі,
 *    Start сам її залогує (dev бачить стек).
 *
 * Місце в ланцюжку — ВСЕРЕДИНІ `withSecurityHeaders` (маскована 500 теж мусить
 * отримати заголовки безпеки) і всередині `withRequestContext` (той лише
 * відкриває контекст і не кидає сам). Ідентифікатор запиту в контексті не
 * живе, тож ref — той самий id, що пішов у лог цим самим викликом.
 * 🔴 `catch` у `server.mjs` ловить тепер лише те, що поза entry: збій
 * `toWebRequest`/`sendWebResponse` і винятки, які Start кидає до виклику entry.
 */
export function withEntryErrorMask<A extends unknown[]>(
  fetch: FetchHandler<A>,
  options: MaskOptions = {},
): (request: Request, ...rest: A) => Promise<Response> {
  return async (request, ...rest) => {
    try {
      return await fetch(request, ...rest);
    } catch (error) {
      const status = httpErrorStatus(error);
      if (status !== undefined && status < 500) throw error;
      const masked = maskUnexpectedError(error, options);
      if (masked === error) throw error;
      return new Response((masked as Error).message, {
        status: status ?? 500,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    }
  };
}
