import { sql } from 'drizzle-orm';
import { createTokensForEntity, setExplicitToken } from 'simplycms/addressing';
import { SLUG_FORMAT, slugify } from 'simplycms/domain/slugs';
import { getLanguagePack } from 'simplycms/i18n';
import { fail, type ChildCtx } from './children-common';
import type { ModificationsInput } from './children-schemas';

type Upsert = NonNullable<ModificationsInput['upsert']>[number];

/** Токен основної мови для нової модифікації: явний, інакше від назви. */
export function baseSlugOf(ctx: ChildCtx, u: Upsert, name: string, at: number) {
  const slug =
    u.token?.[ctx.primary] ?? slugify(name, getLanguagePack(ctx.primary));
  if (!slug || !SLUG_FORMAT.test(slug))
    throw fail(['modifications', 'upsert', at, 'token'], 'path_required');
  return slug;
}

/**
 * Токени модифікації: нова — від бази в усіх мовах `draft`/`published` (І21),
 * явні `token` — за мовами; потім дзеркало `slug`.
 */
export async function applyTokens(
  ctx: ChildCtx,
  u: Upsert,
  isNew: boolean,
  name: string | null | undefined,
  at: number,
): Promise<void> {
  const target = {
    kind: 'modification' as const,
    id: u.id,
    scopeId: ctx.productId,
  };
  if (isNew)
    await createTokensForEntity(ctx.db, target, baseSlugOf(ctx, u, name!, at));
  for (const [locale, slug] of Object.entries(u.token ?? {}))
    await setExplicitToken(ctx.db, target, locale, slug);
  if (isNew || u.token?.[ctx.primary]) await mirrorSlug(ctx, u.id);
}

/** М1-TEMP: зноситься в Task 17 — `slug` дзеркалить поточний токен основної мови. */
export async function mirrorSlug(
  ctx: Pick<ChildCtx, 'db' | 'primary'>,
  modificationId: string,
): Promise<void> {
  await ctx.db.execute(sql`update public.product_modifications m
       set slug = t.slug
      from public.slug_tokens t
     where m.id = ${modificationId} and t.modification_id = m.id
       and t.locale = ${ctx.primary} and t.is_current`);
}
