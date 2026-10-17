import { defaultParseSearch } from '@tanstack/react-router';
import { SLUG_FORMAT, RESERVED_SEGMENTS } from 'simplycms/domain/slugs';
import type { AddressResolution } from 'simplycms/storefront/loaders';
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
  // Токен іде як рядок: роутер JSON-розбирає query, і `?mod=5` для нього число.
  const mod = query.mod === undefined ? null : String(query.mod);
  const hit = await lookup(resolved.locale, path, mod);
  if (!hit) return { pathname, query };

  const prefix = resolved.prefixed ? `/${localePrefix(resolved.locale)}` : '';
  const next = { ...query };
  if (hit.mod !== null && hit.mod !== mod) {
    // Новий токен проходить через той самий розбір, що й query запиту: токен з
    // цифр має стати числом, інакше роутер перепише `?mod=7` на `%227%22`.
    next.mod = (
      defaultParseSearch(`?mod=${encodeURIComponent(hit.mod)}`) as Record<
        string,
        unknown
      >
    ).mod;
  }
  return { pathname: `${prefix}/${hit.path}`, query: next };
}
