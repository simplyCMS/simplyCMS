import { notFound } from '@tanstack/react-router';
import { SLUG_FORMAT } from 'simplycms/domain/slugs';
import { localeOfHref } from '../locale/root-data';
import type { LocaleSet } from '../locale/resolve';
import { productHead } from '../head/product';
import type { HeadMatch } from '../head/head';
import { getProduct } from '../server/products';

/**
 * Query сторінки сутності: лише `mod`. Токен не приводиться до рядка: роутер
 * JSON-розбирає query, і токен з цифр (`?mod=5`) для нього число — рядок `'5'`
 * серіалізувався б як `%225%22`, тобто канонічна адреса розійшлася б з нашою.
 */
export function entitySearch(search: Record<string, unknown>): {
  mod?: string | number;
} {
  return {
    mod:
      typeof search.mod === 'string' || typeof search.mod === 'number'
        ? search.mod
        : undefined,
  };
}

/**
 * Вхід сторінки сутності за адресою `/<path>` та `/<мова>/<path>` (М1, §3.2):
 * тип сутності визначає реєстр адрес, а не форма URL. У М1 сутність одна —
 * товар; адреса, якої немає в реєстрі, — 404 (історичну адресу вже перетворила
 * на один 301 нормалізація до роутера, видалена сутність не лишає рядків).
 *
 * Route-файл — тонка обгортка над цим модулем, щоб тест гнав той самий
 * лоадер без файлового роутера.
 */
export async function loadEntityPage(input: {
  /** Шлях сторінки без префікса мови (splat-параметр роуту). */
  splat: string;
  /** Публічний href роутера: мову сторінки дає префікс у ньому. */
  publicHref: string;
  locales: LocaleSet;
}) {
  // Шлях сутності — один сегмент формату slug: усе інше (`/a/b`, `/Foo`) 404
  // без звернення до БД, а не запит на кожен промах бота.
  if (!SLUG_FORMAT.test(input.splat)) throw notFound();
  const locale = localeOfHref(input.publicHref, input.locales);
  const product = await getProduct({ data: { locale, path: input.splat } });
  if (!product) throw notFound();
  return { product };
}

/** `head()` сторінки сутності (логіка — `head/product`, тестується без роуту). */
export function entityHead(
  matches: ReadonlyArray<HeadMatch>,
  data: Awaited<ReturnType<typeof loadEntityPage>> | undefined,
) {
  return data ? productHead(matches, data.product) : {};
}
