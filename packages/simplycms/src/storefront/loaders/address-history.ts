import { and, eq, isNotNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { slugTokens, urlPaths } from 'simplycms/schema';
import { withStorefrontDb, type ActorDb } from './db';

/** Що реєстр адрес каже про шлях: поточна адреса сутності й токен `?mod=` (якщо спитали). */
export type AddressResolution = {
  /** Поточна адреса сутності в тій самій мові (збігається зі шляхом, якщо він поточний). */
  path: string;
  /**
   * Поточний токен модифікації для названого `mod` (поточного чи історичного);
   * `null` — токен не називали або реєстр його не знає (тоді query лишається як є).
   */
  mod: string | null;
};

/**
 * Резолв адреси товару в реєстрі `url_paths` + токена `?mod=` у `slug_tokens`.
 * Єдине джерело правди адреси — реєстр (П8): поточна адреса дає сторінку,
 * історична — поточну адресу для ОДНОГО 301, невідома (зокрема видалена
 * сутність: історія зникає каскадом) — `null`, тобто роутер відповість 404.
 */
export async function resolveProductAddress(
  db: ActorDb,
  locale: string,
  path: string,
  mod: string | null,
): Promise<AddressResolution | null> {
  const current = alias(urlPaths, 'current_path');
  const [hit] = await db
    .select({ productId: urlPaths.productId, path: current.path })
    .from(urlPaths)
    .innerJoin(
      current,
      and(
        eq(current.productId, urlPaths.productId),
        eq(current.locale, urlPaths.locale),
        eq(current.isCurrent, true),
      ),
    )
    .where(
      and(
        eq(urlPaths.locale, locale),
        eq(urlPaths.path, path),
        isNotNull(urlPaths.productId),
      ),
    )
    .limit(1);
  if (!hit || hit.productId === null) return null;
  return {
    path: hit.path,
    mod:
      mod === null ? null : await currentToken(db, locale, hit.productId, mod),
  };
}

/** Поточний токен модифікації товару за будь-яким її токеном мови (`null` — токен невідомий). */
async function currentToken(
  db: ActorDb,
  locale: string,
  productId: string,
  token: string,
): Promise<string | null> {
  const current = alias(slugTokens, 'current_token');
  const [hit] = await db
    .select({ slug: current.slug })
    .from(slugTokens)
    .innerJoin(
      current,
      and(
        eq(current.modificationId, slugTokens.modificationId),
        eq(current.locale, slugTokens.locale),
        eq(current.isCurrent, true),
      ),
    )
    .where(
      and(
        eq(slugTokens.locale, locale),
        eq(slugTokens.scopeId, productId),
        eq(slugTokens.slug, token),
        isNotNull(slugTokens.modificationId),
      ),
    )
    .limit(1);
  return hit?.slug ?? null;
}

/** Резолв у власній транзакції вітрини: для нормалізації адреси ДО роутера. */
export function lookupProductAddress(
  locale: string,
  path: string,
  mod: string | null,
): Promise<AddressResolution | null> {
  return withStorefrontDb((db) => resolveProductAddress(db, locale, path, mod));
}
