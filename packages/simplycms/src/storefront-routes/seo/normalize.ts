// Серіалізатори query беремо з пакета роутера (реекспорт router-core): це ті
// самі функції, які роутер за замовчуванням застосовує до `location.search`.
import {
  defaultParseSearch,
  defaultStringifySearch,
} from '@tanstack/react-router';
import {
  loadLocaleSet,
  lookupProductAddress,
} from 'simplycms/storefront/loaders';
import { getRequestContext } from 'simplycms/site/request-context';
import {
  isStorefrontPath,
  resolveRequestLocale,
  type LocaleSet,
} from '../locale/resolve';
import { applyHistory, type AddressLookup } from './history';

export type { AddressLookup } from './history';

/**
 * Нормалізація адреси вітрини ДО роутера: рівно ОДИН 301 на кінцеву адресу.
 *
 * Чому тут, а не в роутері: канонізація router-core (`loadServerRoute`) віддає
 * 307 і опції, що міняє статус чи вимикає її, у цій версії немає. Тож 301 віддає
 * сама обгортка серверного входу, а роутерна канонізація лишається страховкою.
 *
 * Кроки складаються в одну кінцеву адресу, а не в ланцюжок редіректів: префікс
 * основної мови, слеш, ІСТОРІЯ адреси сутності, історичний `?mod=` і форма query
 * — усе це змінює одну й ту саму ціль, і редірект один (І20).
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
 * Захисний інваріант виходу (відкритий редирект): `Location` будь-якого кроку
 * — шлях на ТОМУ САМОМУ origin. Після зняття префікса мови `rest` міг би
 * початися з `//` (`/uk//evil.example` → `//evil.example`), а браузер читає
 * це як адресу іншого сайту. Тому `/` і `\` (URL-парсер трактує `\` як `/`)
 * схлопуються в один `/`, а результат, що все ж не є «один `/`, далі не `/` і
 * не `\`», не віддається взагалі (404). Інваріант на виході, а не латка
 * окремого кроку: він захищає й кроки, які дописує Task 15.
 */
function sameOriginPath(pathname: string): string | null {
  const collapsed = pathname.replace(/[\\/]{2,}/g, '/').replace(/\\/g, '/');
  return /^\/(?![\\/])/.test(collapsed) || collapsed === '/' ? collapsed : null;
}

/**
 * Query запиту, розібраний як у роутера, АЛЕ токен `mod` береться рядком із сирого
 * `url.search`. Роутер JSON-розбирає значення: `1e5` стає `100000`, 17+ цифр
 * втрачають точність, `true` — булеве; нормалізація, що взяла б розібране значення,
 * 301-ила б на ІНШИЙ токен. Токен — завжди рядок (`entitySearch`), а лапкована форма
 * `?mod=%221e5%22` читається назад рівно як `'1e5'`, тож 301 веде на канонічну форму
 * ТОГО САМОГО токена і без петлі. Масив (`mod=a&mod=b`) роутер відкидає сам.
 */
function parseQueryKeepingToken(url: URL): Record<string, unknown> {
  const query = defaultParseSearch(url.search) as Record<string, unknown>;
  const raw = url.searchParams.get('mod');
  const parsed = query.mod;
  if (raw !== null && !Array.isArray(parsed) && typeof parsed !== 'string') {
    query.mod = raw;
  }
  return query;
}

/**
 * Відповідь нормалізації або `null` (запит іде далі в роутер).
 *
 * - префікс відомої, але неопублікованої мови → 404;
 * - префікс мови над невітринним шляхом (`/en/api/…`, `/uk/media/…`) → 404:
 *   інакше той самий ресурс мав би дубль адреси під кожною мовою;
 * - префікс основної мови, завершальний слеш, зайві слеші, історична адреса,
 *   історичний `?mod=` → ОДИН 301 на кінцеву адресу;
 * - query серіалізується ТИМ САМИМ `defaultParseSearch`/`defaultStringifySearch`,
 *   що й роутер: так закодований (`?utm=%31`) чи повторений (`?a=1&a=2`) параметр
 *   дає один наш 301 на форму, яку роутер вважає канонічною, а не 301, за яким
 *   роутер додає ще й 307. Невідомі й дозволені параметри зберігаються.
 */
export async function normalizeStorefrontRequest(
  url: URL,
  set: LocaleSet,
  lookup: AddressLookup = lookupProductAddress,
): Promise<Response | null> {
  if (!isStorefrontPath(url.pathname)) return null;

  const resolved = resolveRequestLocale(url.pathname, set);
  if (resolved.prefixed && !set.published.includes(resolved.locale)) {
    return notFound();
  }
  if (resolved.prefixed && !isStorefrontPath(resolved.rest)) return notFound();

  const stepped = STEPS.reduce<Target>((acc, step) => step(acc, set), {
    pathname: url.pathname,
  });
  const safePath = sameOriginPath(stepped.pathname);
  if (safePath === null) return notFound();

  const history = await applyHistory(
    safePath,
    parseQueryKeepingToken(url),
    set,
    lookup,
  );
  const target = sameOriginPath(history.pathname);
  if (target === null) return notFound();

  const search = defaultStringifySearch(history.query);
  if (target === url.pathname && search === url.search) return null;

  return new Response(null, {
    status: 301,
    headers: { location: target + search },
  });
}

/** Базовий хендлер, у який іде запит після нормалізації. */
export type StorefrontDelegate<TArgs extends unknown[]> = (
  request: Request,
  ...args: TArgs
) => Promise<Response> | Response;

/**
 * Обгортка серверного входу: мови з кешу з поколіннями → нормалізація
 * (301/404) → набір мов у контекст запиту → делегат (SEO-інтерсептор і Start).
 * Стоїть ВСЕРЕДИНІ `withRequestContext`, інакше нікуди писати.
 *
 * Нормалізують лише GET/HEAD: редірект перетворив би POST на GET і загубив
 * тіло.
 */
export function withStorefrontNormalize<TArgs extends unknown[]>(
  delegate: StorefrontDelegate<TArgs>,
): (request: Request, ...args: TArgs) => Promise<Response> {
  return async (request, ...args) => {
    const url = new URL(request.url);
    // Сторінку рендерять лише GET/HEAD вітринних шляхів. Решта (POST, server
    // functions, API, медіа, статика, адмінка) іде далі БЕЗ читання мов: CSRF
    // і авторизація спрацьовують раніше за БД, а набір мов для сторінки, що
    // все ж відрендериться (404 під `/api`, адмінка), роутер дочитає лінивo
    // (`resolveRouterLocales` у `beforeLoad` кореня).
    const isPageRequest =
      (request.method === 'GET' || request.method === 'HEAD') &&
      isStorefrontPath(url.pathname);
    if (!isPageRequest) return delegate(request, ...args);

    const locales = await loadLocaleSet();
    const response = await normalizeStorefrontRequest(url, locales);
    if (response !== null) return response;
    const ctx = getRequestContext();
    if (ctx) ctx.storefront = { locales };
    return delegate(request, ...args);
  };
}
