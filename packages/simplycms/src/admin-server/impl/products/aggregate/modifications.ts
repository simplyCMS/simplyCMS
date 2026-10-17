import { eq, sql } from 'drizzle-orm';
import { advisoryXactLock } from 'simplycms/db';
import { LOCK_KEYS } from 'simplycms/db/lock-keys';
import {
  planTranslationWrite,
  type TranslationWritePlan,
} from 'simplycms/domain/translations';
import { productModifications } from 'simplycms/schema';
import {
  TRANSLATABLE,
  applyTranslationPlan,
  loadTranslations,
  sourceFieldHash,
} from 'simplycms/translations';
import {
  fail,
  NOOP,
  requireDistinct,
  requireLocales,
  type ChildCtx,
  type Step,
} from './children-common';
import type { ModificationsInput } from './children-schemas';
import { deleteModifications } from '../../product-modifications/delete';
import { assertNotForeign } from './modification-scope';
import { applyTokens, baseSlugOf } from './modification-tokens';
import { remapPlanIssues } from './schemas';

const SPEC = TRANSLATABLE.productModification;
export async function planModifications(
  ctx: ChildCtx,
  existing: ReadonlySet<string>,
  input: ModificationsInput | undefined,
): Promise<Step> {
  const upserts = input?.upsert ?? [];
  const removes = input?.remove ?? [];
  if (upserts.length === 0 && removes.length === 0) return NOOP;
  requireDistinct(
    upserts.map((u) => u.id),
    (i) => ['modifications', 'upsert', i, 'id'],
  );
  const removing = new Set(removes);
  upserts.forEach((u, i) => {
    if (removing.has(u.id))
      throw fail(['modifications', 'upsert', i, 'id'], 'invalid_value');
  });
  const defaults = upserts.filter((u) => u.isDefault === true);
  if (defaults.length > 1)
    throw fail(['modifications', 'upsert', 'isDefault'], 'invalid_value');
  if (upserts.length > 0) await assertNotForeign(ctx, upserts, existing);

  const stored = await loadTranslations(
    ctx.db,
    SPEC,
    upserts.filter((u) => existing.has(u.id)).map((u) => u.id),
  );
  const prepared = upserts.map((u, i) => {
    const at = ['modifications', 'upsert', i] as const;
    requireLocales(ctx, u.texts, (l) => [...at, 'texts', l]);
    requireLocales(ctx, u.token, (l) => [...at, 'token', l]);
    const all = stored.get(u.id) ?? new Map();
    const byLocale = new Map(all);
    byLocale.delete(ctx.primary);
    const plan: TranslationWritePlan = remapPlanIssues([...at, 'texts'], () =>
      planTranslationWrite({
        spec: SPEC,
        current: { source: all.get(ctx.primary) ?? null, byLocale },
        primary: ctx.primary,
        patch: new Map(
          Object.entries(u.texts ?? {}).map(([l, t]) => [l, { name: t.name }]),
        ),
        hash: sourceFieldHash,
      }),
    );
    const name = plan.upserts.find((x) => x.locale === ctx.primary)?.values
      .name;
    const isNew = !existing.has(u.id);
    // Нова модифікація без назви основної мови: `name` NOT NULL (до Task 17) і І4.
    if (isNew && !name)
      throw fail([...at, 'texts', ctx.primary, 'name'], 'too_small');
    return { u, i, plan, name, isNew };
  });
  // Токен нової модифікації — ДО запису (400 раніше за 412).
  for (const p of prepared) if (p.isNew) baseSlugOf(ctx, p.u, p.name!, p.i);

  return {
    async apply() {
      const db = ctx.db;
      if (removes.length > 0)
        await deleteModifications(db, {
          productIds: [ctx.productId],
          ids: removes,
        });
      if (defaults[0]) {
        // Той самий замок, що в `setDefaultModification`: дефолт — один на товар.
        await advisoryXactLock(
          db,
          `${LOCK_KEYS.modDefaultPrefix}${ctx.productId}`,
        );
        await db.execute(sql`update public.product_modifications
          set is_default = false, updated_at = now()
          where product_id = ${ctx.productId} and is_default and id <> ${defaults[0].id}`);
      }
      for (const { u, i, plan, name, isNew } of prepared) {
        if (isNew)
          // М1-TEMP: зноситься в Task 17 — `slug` (NOT NULL) спершу id, далі токен
          // основної мови; `name` дзеркалить назву основної мови.
          await db.insert(productModifications).values({
            id: u.id,
            productId: ctx.productId,
            slug: u.id,
            name: name!,
            sku: u.sku ?? null,
            isDefault: u.isDefault === true,
            sortOrder: u.sortOrder ?? 0,
            ...(u.stockStatus && { stockStatus: u.stockStatus }),
          });
        else
          await db
            .update(productModifications)
            .set({
              ...(u.sku === undefined ? {} : { sku: u.sku }),
              ...(u.isDefault === undefined ? {} : { isDefault: u.isDefault }),
              ...(u.sortOrder === undefined ? {} : { sortOrder: u.sortOrder }),
              ...(u.stockStatus ? { stockStatus: u.stockStatus } : {}),
              ...(name ? { name } : {}), // М1-TEMP: зноситься в Task 17
              updatedAt: new Date(),
            })
            .where(eq(productModifications.id, u.id));
        await applyTranslationPlan(db, SPEC, u.id, plan, {
          product_id: ctx.productId,
        });
        await applyTokens(ctx, u, isNew, name, i);
      }
    },
  };
}
