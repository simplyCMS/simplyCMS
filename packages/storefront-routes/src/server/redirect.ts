/**
 * 302-редірект для серверних route-handler-ів.
 *
 * 🔴 НЕ використовувати тут `Response.redirect()` — і не «спрощувати» до нього
 * пізніше. За специфікацією Fetch `Response.redirect()` повертає відповідь,
 * чиї `Headers` мають guard `immutable`: будь-яка спроба їх змінити кидає
 * `TypeError`.
 *
 * Start проганяє відповідь handler-а через `mergeEventResponseHeaders`
 * (`@tanstack/start-server-core`). Для НЕ-ok відповіді (302 — саме така), якщо
 * в h3-евенті вже є `set-cookie` (їх кладе `createServerSupabase` після
 * `verifyOtp` / `exchangeCodeForSession`), він робить
 * `response.headers.delete('set-cookie')` — і на immutable-headers падає.
 * Наслідок: користувач отримує 500 без auth-cookies замість 302 із сесією.
 * Ламається саме УСПІШНА гілка; гілка помилки виживає, бо там cookies немає.
 *
 * `new Response(...)` дає headers із guard `response` — мутабельні для
 * `append`/`delete`, тож merge відпрацьовує штатно.
 *
 * Гард — `src/__tests__/auth-redirect-cookies.test.ts` (ганяє handler-и через
 * справжній `requestHandler`).
 */
export function redirectResponse(location: string): Response {
  // 🔴 `new URL(...).href` повертає нормалізацію, яку `Response.redirect()`
  // робив сам: percent-encoding не-ASCII і зрізання CR/LF. Без неї `Headers`
  // кидає `TypeError` на кирилицю в `?next=` (вона декодована ще
  // `searchParams.get`) — і це 500 ПІСЛЯ спаленого одноразового OTP.
  // Обидва виклики передають абсолютний URL, тож база `new URL` не потрібна.
  return new Response(null, {
    status: 302,
    headers: { Location: new URL(location).href },
  });
}
