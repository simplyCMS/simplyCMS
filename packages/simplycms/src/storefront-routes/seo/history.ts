import { SLUG_FORMAT, RESERVED_SEGMENTS } from 'simplycms/domain/slugs';
import type { AddressResolution } from 'simplycms/storefront/loaders';
import {
  localePrefix,
  resolveRequestLocale,
  type LocaleSet,
} from '../locale/resolve';

const isPrimitive = (v: unknown): boolean =>
  typeof v === 'string' ||
  typeof v === 'number' ||
  typeof v === 'boolean' ||
  v === null;

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
  // Токен іде як рядок: роутер JSON-розбирає query, і `?mod=5`/`true`/`null` для нього
  // не рядки (див. `entitySearch`). Не примітив (масив, об'єкт) роутер відкине сам.
  const mod = isPrimitive(query.mod) ? String(query.mod) : null;
  const hit = await lookup(resolved.locale, path, mod);
  if (!hit) return { pathname, query };

  const prefix = resolved.prefixed ? `/${localePrefix(resolved.locale)}` : '';
  const next = { ...query };
  // `mod` у кінцевій адресі — завжди рядок (як його бачить `entitySearch`): токен з цифр
  // тоді серіалізується лапкованою формою, яку роутер вважає канонічною, і другого
  // (307) редіректу немає. Історичний токен замінюється поточним; не примітив — геть.
  if (hit.mod !== null) next.mod = hit.mod;
  else if (mod !== null) next.mod = mod;
  else delete next.mod;
  return { pathname: `${prefix}/${hit.path}`, query: next };
}
