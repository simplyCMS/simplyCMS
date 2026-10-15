import { loadLocaleSet } from 'simplycms/storefront/loaders';
import { getRequestContext } from 'simplycms/site/request-context';
import {
  isStorefrontPath,
  resolveRequestLocale,
  type LocaleSet,
} from '../locale/resolve';

/**
 * Нормалізація адреси вітрини ДО роутера: рівно ОДИН 301 на кінцеву адресу.
 *
 * Чому тут, а не в роутері: канонізація router-core (`loadServerRoute`) віддає
 * 307 і опції, що міняє статус чи вимикає її, у цій версії немає. Тож 301 на
 * префікс основної мови й завершальний слеш віддає сама обгортка серверного
 * входу, а роутерна канонізація лишається страховкою.
 *
 * Кроки складаються в одну кінцеву адресу, а не в ланцюжок редіректів: Task 15
 * дописує сюди історію адрес і `?mod=`, і ця функція так само дасть один 301.
 */

type Target = { pathname: string };
type Step = (target: Target, set: LocaleSet) => Target;

/** `/<основна>/x` → `/x`: основна мова живе без префікса (майстер §3.2). */
const stripPrimaryPrefix: Step = (target, set) => {
  const resolved = resolveRequestLocale(target.pathname, set);
  return resolved.prefixed && resolved.locale === set.primary
    ? { pathname: resolved.rest }
    : target;
};

/**
 * `/x/` → `/x` (корінь лишається `/`). Це той шлях, який роутер вважає
 * канонічним при `trailingSlash: 'never'`: віддаючи його самі, ми не потрапляємо
 * у 307 роутера і не робимо циклу.
 */
const stripTrailingSlash: Step = (target) => ({
  pathname: target.pathname.replace(/\/+$/, '') || '/',
});

const STEPS: readonly Step[] = [stripPrimaryPrefix, stripTrailingSlash];

function notFound(): Response {
  return new Response('Not Found', {
    status: 404,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      // Мову можуть опублікувати будь-якої миті: 404 не лишаємо в кешах.
      'cache-control': 'no-store',
    },
  });
}

/**
 * Відповідь нормалізації або `null` (запит іде далі в роутер).
 *
 * - префікс відомої, але неопублікованої мови → 404;
 * - префікс основної мови, завершальний слеш → 301 на кінцеву адресу;
 * - query зберігається як є (байт у байт: порядок і `utm_*`).
 */
export function normalizeStorefrontRequest(
  url: URL,
  set: LocaleSet,
): Response | null {
  if (!isStorefrontPath(url.pathname)) return null;

  const resolved = resolveRequestLocale(url.pathname, set);
  if (resolved.prefixed && !set.published.includes(resolved.locale)) {
    return notFound();
  }

  const target = STEPS.reduce<Target>((acc, step) => step(acc, set), {
    pathname: url.pathname,
  });
  if (target.pathname === url.pathname) return null;

  return new Response(null, {
    status: 301,
    headers: { location: target.pathname + url.search },
  });
}

/** Базовий хендлер, у який іде запит після нормалізації. */
export type StorefrontDelegate<TArgs extends unknown[]> = (
  request: Request,
  ...args: TArgs
) => Promise<Response> | Response;

// Запити без сторінки: Start створює для них роутер (`getRouter()`), але мови
// їм не потрібні, а читати кеш мов на кожне зображення чи виклик API —
// зайвий запит до БД (поколіннєвий `select`). Такі запити йдуть далі без набору.
const NO_ROUTER_PREFIXES = ['/_serverFn/', '/api/', '/assets/', '/media/'];

function isRouterRequest(pathname: string): boolean {
  return !NO_ROUTER_PREFIXES.some((p) => pathname.startsWith(p));
}

/**
 * Обгортка серверного входу: мови з кешу з поколіннями → нормалізація
 * (301/404) → набір мов у контекст запиту → делегат (SEO-інтерсептор і Start).
 * Стоїть ВСЕРЕДИНІ `withRequestContext`, інакше нікуди писати.
 *
 * Нормалізують лише GET/HEAD: редірект перетворив би POST на GET і загубив
 * тіло. Набір мов у контекст пишемо завжди, коли запит дійде до роутера.
 */
export function withStorefrontNormalize<TArgs extends unknown[]>(
  delegate: StorefrontDelegate<TArgs>,
): (request: Request, ...args: TArgs) => Promise<Response> {
  return async (request, ...args) => {
    const url = new URL(request.url);
    if (!isRouterRequest(url.pathname)) return delegate(request, ...args);

    const locales = await loadLocaleSet();
    if (request.method === 'GET' || request.method === 'HEAD') {
      const response = normalizeStorefrontRequest(url, locales);
      if (response !== null) return response;
    }
    const ctx = getRequestContext();
    if (ctx) ctx.storefront = { locales };
    return delegate(request, ...args);
  };
}
