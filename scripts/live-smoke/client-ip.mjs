/**
 * Окрема «IP-адреса» кожному контексту браузера прогону.
 *
 * Better Auth лімітує запити (`/sign-in/email` — 3 за 10 с, решта шляхів — 100
 * за хвилину) за IP клієнта. Прогін іде з одного localhost без проксі, тож IP
 * невизначений і бакет ОДИН на всіх покупців, власника й кожне завантаження
 * сторінки: підтверджена реєстрація (Р30) додала входи й переходи за
 * посиланнями, і прогін впирався в 429 на `get-session`. У проді перед
 * магазином стоїть проксі з `X-Forwarded-For` — тут його імітуємо, і кожен
 * контекст має власний бакет, як окремий реальний покупець.
 */
export function withClientIps(browser) {
  let n = 0;
  const headers = () => ({ 'x-forwarded-for': `10.77.0.${++n}` });
  const newContext = browser.newContext.bind(browser);
  const newPage = browser.newPage.bind(browser);
  browser.newContext = (options = {}) =>
    newContext({
      ...options,
      extraHTTPHeaders: { ...options.extraHTTPHeaders, ...headers() },
    });
  browser.newPage = (options = {}) =>
    newPage({
      ...options,
      extraHTTPHeaders: { ...options.extraHTTPHeaders, ...headers() },
    });
  return browser;
}
