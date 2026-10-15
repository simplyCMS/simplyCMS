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
 *
 * 🔴 Це імітація для прогону, а не перевірка продового визначення IP клієнта.
 */
let counter = 0;
const nextIp = () => `10.77.0.${++counter}`;

/**
 * «Новий відвідувач» у наявному контексті: інший IP і свій бакет ліміту, але та
 * сама сесія (cookie). Замінює очікування вікна `/sign-in/email` (3 за 10 с).
 */
export function rotateClientIp(context) {
  return context.setExtraHTTPHeaders({ 'x-forwarded-for': nextIp() });
}

export function withClientIps(browser) {
  const headers = () => ({ 'x-forwarded-for': nextIp() });
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
