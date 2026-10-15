import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { slugTokens } from 'simplycms/schema';
import { AdminConflictError } from 'simplycms/contracts/domain-errors';
import {
  advisoryXactLockShared,
  isUniqueViolation,
  type ActorDb,
} from 'simplycms/db';
import { LOCK_KEYS } from 'simplycms/db/lock-keys';
import {
  allocateIn,
  activeLocales,
  assertSlugFormat,
  textArray,
} from './shared';

/** Сутність, якій належить токен; `scopeId` — область (для модифікації товар). */
export type TokenTarget = { kind: 'modification'; id: string; scopeId: string };

/**
 * Поточні токени нової модифікації в усіх мовах `draft`/`published` — дзеркало
 * `createPathsForEntity`: той самий замок (набір мов читається ПІСЛЯ нього),
 * той самий `allocateSlug`, але
 * простір імен `(locale, token_kind, scope_id)`: однаковий slug у різних
 * товарів дозволений. Службові сегменти модифікацій не стосуються (вони в
 * `?mod=`, а не в сегменті шляху).
 */
export async function createTokensForEntity(
  db: ActorDb,
  target: TokenTarget,
  baseSlug: string,
): Promise<Map<string, string>> {
  assertSlugFormat(baseSlug, 'slug');
  await advisoryXactLockShared(db, LOCK_KEYS.languagesSet);
  const locales = await activeLocales(db);
  const result = new Map<string, string>();
  if (locales.length === 0) return result;
  const rows = await db.execute<{ locale: string; slug: string }>(sql`
    select locale, slug from public.slug_tokens
     where locale = any(${textArray(locales)})
       and token_kind = 'modification' and scope_id = ${target.scopeId}
       and (slug = ${baseSlug} or slug like ${`${baseSlug}-%`})`);
  const values = locales.map((locale) => {
    const taken = new Set(
      rows.rows.filter((r) => r.locale === locale).map((r) => r.slug),
    );
    const slug = allocateIn(baseSlug, taken);
    result.set(locale, slug);
    return {
      locale,
      slug,
      scopeId: target.scopeId,
      modificationId: target.id,
      isCurrent: true,
    };
  });
  await db
    .insert(slugTokens)
    .values(values.map((v) => ({ id: randomUUID(), ...v })));
  return result;
}

/**
 * Явна зміна токена: чужий поточний чи історичний — 409 `slug_taken`; власний
 * історичний знову стає поточним, колишній поточний іде в історію.
 */
export async function setExplicitToken(
  db: ActorDb,
  target: TokenTarget,
  locale: string,
  slug: string,
): Promise<void> {
  assertSlugFormat(slug, 'slug');
  const found = await db.execute<{ owner: string; is_current: boolean }>(
    sql`select modification_id as owner, is_current from public.slug_tokens
         where locale = ${locale} and token_kind = 'modification'
           and scope_id = ${target.scopeId} and slug = ${slug}`,
  );
  const row = found.rows[0];
  if (row && row.owner !== target.id)
    throw new AdminConflictError('unique', 'slug_taken');
  if (row?.is_current) return;
  await db.execute(sql`update public.slug_tokens set is_current = false
      where locale = ${locale} and modification_id = ${target.id} and is_current`);
  if (row) {
    await db.execute(sql`update public.slug_tokens set is_current = true
        where locale = ${locale} and token_kind = 'modification'
          and scope_id = ${target.scopeId} and slug = ${slug}`);
    return;
  }
  try {
    await db.insert(slugTokens).values({
      id: randomUUID(),
      locale,
      slug,
      scopeId: target.scopeId,
      modificationId: target.id,
      isCurrent: true,
    });
  } catch (error) {
    if (isUniqueViolation(error))
      throw new AdminConflictError('unique', 'slug_taken');
    throw error;
  }
}

/** Токен у межах області: сутність, поточний slug і чи сам він поточний. */
export async function resolveToken(
  db: ActorDb,
  locale: string,
  scopeId: string,
  slug: string,
): Promise<{
  target: TokenTarget;
  currentSlug: string;
  isCurrent: boolean;
} | null> {
  const res = await db.execute<{
    modification_id: string;
    is_current: boolean;
    current_slug: string | null;
  }>(sql`select t.modification_id, t.is_current, c.slug as current_slug
           from public.slug_tokens t
           left join public.slug_tokens c
             on c.modification_id = t.modification_id
            and c.locale = t.locale and c.is_current
          where t.locale = ${locale} and t.token_kind = 'modification'
            and t.scope_id = ${scopeId} and t.slug = ${slug}`);
  const row = res.rows[0];
  if (!row) return null;
  return {
    target: { kind: 'modification', id: row.modification_id, scopeId },
    currentSlug: row.current_slug ?? slug,
    isCurrent: row.is_current,
  };
}
