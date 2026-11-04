import { useRouteContext, useRouterState } from '@tanstack/react-router';
import type { ContentLocale } from 'simplycms/contracts';
import { localeOfHref } from 'simplycms/domain';
import type { RouterContext } from './router-context';

/**
 * Мова КОНТЕНТУ сторінки: з першого сегмента публічного href (І30) через ту саму пару
 * `localeOfHref` + набір мов контексту, що й `useRequestTranslator`. Другого парсера сегмента
 * немає. Це вісь даних (ключі кешу, `locale` серверних функцій), а не мова інтерфейсу.
 *
 * Окремий клієнтобезпечний субшлях, а не барель `simplycms/runtime`: барель тримає складання
 * магазину (`defineRuntime`), якого споживачам хука тягнути не треба.
 */
export function useContentLocale(): ContentLocale {
  const publicHref = useRouterState({ select: (s) => s.location.publicHref });
  const { locales }: RouterContext = useRouteContext({ strict: false });
  return localeOfHref(publicHref, locales);
}
