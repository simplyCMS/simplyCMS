import {
  defaultStringifySearch,
  notFound,
  redirect,
} from '@tanstack/react-router';
import { productPath } from 'simplycms/domain';
import { RESERVED_SEGMENTS, SLUG_FORMAT } from 'simplycms/domain/slugs';
import { localeOfHref } from '../locale/root-data';
import type { LocaleSet } from '../locale/resolve';
import { productHead } from '../head/product';
import type { HeadMatch } from '../head/head';
import { getMovedProductPath, getProduct } from '../server/products';
import { queryAfterHistory, tokenOf } from './entity-history';

/**
 * Query сторінки сутності: лише `mod`, і токен — ЗАВЖДИ рядок. Роутер JSON-розбирає
 * query, тож токен `5`, `true`, `null` чи `1e5` приходить числом/булевим/null; без
 * приведення вибір модифікації (порівняння зі slug-ом) ламається. Рядок із цифр
 * роутер канонізує в лапкованій формі (`?mod=%225%22`) — нормалізація пише ту саму
 * форму тим самим серіалізатором (`seo/history.ts`), тож 307 роутера не додається.
 * Значення, що не є примітивом (об'єкт, масив), відкидаються. `1e5` роутер
 * переписує в `100000` ще до валідатора — такий токен не відновити, тому вибір
 * дефолтний (токени з експонентою — ризик генератора, не нормалізації).
 */
export function entitySearch(search: Record<string, unknown>): {
  mod?: string;
} {
  const mod = search.mod;
  const primitive =
    typeof mod === 'string' ||
    typeof mod === 'number' ||
    typeof mod === 'boolean' ||
    mod === null;
  return { mod: primitive ? String(mod) : undefined };
}

/**
 * Вхід сторінки сутності за адресою `/<path>` та `/<мова>/<path>` (М1, §3.2):
 * тип сутності визначає реєстр адрес, а не форма URL. У М1 сутність одна —
 * товар; адреса, якої немає в реєстрі, — 404 (історичну адресу на серверному GET
 * перетворює на один 301 нормалізація до роутера, на клієнтській навігації — редирект
 * тут; видалена сутність не лишає рядків).
 *
 * Route-файл — тонка обгортка над цим модулем, щоб тест гнав той самий
 * лоадер без файлового роутера.
 */
export async function loadEntityPage(input: {
  /** Шлях сторінки без префікса мови (параметр роуту). */
  path: string;
  /** Публічний href роутера: мову сторінки дає префікс у ньому. */
  publicHref: string;
  locales: LocaleSet;
  /** Розібраний query сторінки: редирект історичної адреси його зберігає. */
  search?: Record<string, unknown>;
}) {
  // Шлях сутності — один сегмент формату slug і не службовий: усе інше (`/Foo`,
  // `/my`) 404 без звернення до БД, а не запит на кожен промах бота.
  if (!SLUG_FORMAT.test(input.path) || RESERVED_SEGMENTS.includes(input.path))
    throw notFound();
  const locale = localeOfHref(input.publicHref, input.locales);
  const product = await getProduct({ data: { locale, path: input.path } });
  if (!product) {
    // Клієнтська навігація на історичну адресу: нормалізація (301) працює лише на серверному
    // GET, тож тут той самий резолвер дає редирект замість 404. На сервері історію вже
    // перевірила нормалізація до роутера — другий запит на кожен промах бота зайвий.
    // Query — тим самим правилом, що серверна нормалізація: решта параметрів як є, історичний
    // `?mod=` — поточним токеном (`entity-history.ts`).
    if (typeof window !== 'undefined') {
      const search = input.search ?? {};
      const moved = await getMovedProductPath({
        data: { locale, path: input.path, mod: tokenOf(search) },
      });
      if (moved) {
        const href = productPath({
          path: moved.path,
          locale,
          primary: input.locales.primary,
        }).href;
        throw redirect({
          href:
            href + defaultStringifySearch(queryAfterHistory(search, moved.mod)),
          replace: true,
        });
      }
    }
    throw notFound();
  }
  return { product };
}

/** `head()` сторінки сутності (логіка — `head/product`, тестується без роуту). */
export function entityHead(
  matches: ReadonlyArray<HeadMatch>,
  data: Awaited<ReturnType<typeof loadEntityPage>> | undefined,
) {
  return data ? productHead(matches, data.product) : {};
}
