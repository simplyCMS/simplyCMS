import { AsyncLocalStorage } from 'node:async_hooks';
import type { LocaleSet } from 'simplycms/i18n';

/**
 * Стан вітрини в межах одного HTTP-запиту, який виставляє нормалізація на
 * вході (`withStorefrontNormalize`) і читають `getRouter()` та інші споживачі
 * замість повторного розбору адреси. Поля додає той, хто резолвить раніше
 * за роутер (Task 15 — адресу сутності).
 */
export type StorefrontRequestState = {
  /** Набір мов цього запиту: з кешу мов, прочитаний один раз. */
  readonly locales: LocaleSet;
};

/**
 * Контекст запиту ядра. Поля ліниві: їх виставляє той, хто першим потребує
 * (покоління кешів — `readGenerations`), а не обгортка.
 */
export type RequestContext = {
  /**
   * Мемоізований запит поколінь кешів: ОДИН `select` на HTTP-запит, скільки б
   * кешів (профіль, тема, мови) не читали сторінку (Д6).
   */
  generations?: Promise<ReadonlyMap<string, bigint>>;
  storefront?: StorefrontRequestState;
};

const storage = new AsyncLocalStorage<RequestContext>();

/**
 * Обгортка fetch-handler-а сервера (форма generic, щоб приймати й Start-хендлер з
 * додатковими аргументами): кожен запит біжить у власному порожньому
 * контексті. Спільний між запитами контекст віддав би одному запиту покоління,
 * прочитані іншим раніше, — тобто кеш не бачив би мутації до кінця процесу.
 */
export function withRequestContext<A extends unknown[]>(
  fetch: (req: Request, ...rest: A) => Response | Promise<Response>,
): (req: Request, ...rest: A) => Promise<Response> {
  // Додаткові аргументи (`opts` Start-хендлера) проходять без змін.
  return async (req, ...rest) => storage.run({}, () => fetch(req, ...rest));
}

/** Контекст поточного запиту; `undefined` поза запитом (CLI, фонові задачі). */
export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}
