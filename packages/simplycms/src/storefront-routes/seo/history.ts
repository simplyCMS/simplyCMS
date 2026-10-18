import { SLUG_FORMAT, RESERVED_SEGMENTS } from 'simplycms/domain/slugs';
import type { AddressResolution } from 'simplycms/storefront/loaders';
import { queryAfterHistory, tokenOf } from '../pages/entity-history';
import {
  localePrefix,
  resolveRequestLocale,
  type LocaleSet,
} from '../locale/resolve';

/** Резолвер реєстру адрес: ін'єкція, щоб крок історії тестувався без БД. */
export type AddressLookup = (
  locale: string,
  path: string,
  mod: string | null,
) => Promise<AddressResolution | null>;

/**
 * Крок історії: шлях сутності, що є ІСТОРИЧНОЮ адресою, замінюється поточною
 * адресою тієї ж мови, а `?mod=` зі старим токеном — поточним токеном (майстер
 * §3.2). Кандидат — рівно один сегмент формату slug поза службовими: решта
 * (`/cart`, `/catalog`, `/a/b`) ніколи не лежить у реєстрі, тож запиту до БД
 * не потребує. Невідомий шлях лишається як є — 404 дасть роутер.
 */
export async function applyHistory(
  pathname: string,
  query: Record<string, unknown>,
  set: LocaleSet,
  lookup: AddressLookup,
): Promise<{ pathname: string; query: Record<string, unknown> }> {
  const resolved = resolveRequestLocale(pathname, set);
  const path = resolved.rest.slice(1);
  if (!SLUG_FORMAT.test(path) || RESERVED_SEGMENTS.includes(path)) {
    return { pathname, query };
  }
  const hit = await lookup(resolved.locale, path, tokenOf(query));
  if (!hit) return { pathname, query };

  const prefix = resolved.prefixed ? `/${localePrefix(resolved.locale)}` : '';
  // Правило query — спільне з клієнтським редиректом (`pages/entity-history.ts`).
  return {
    pathname: `${prefix}/${hit.path}`,
    query: queryAfterHistory(query, hit.mod),
  };
}
