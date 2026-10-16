import { sql } from 'drizzle-orm';
import { planTranslationWrite } from 'simplycms/domain/translations';
import { productImages } from 'simplycms/schema';
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
  uuidArray,
  type ChildCtx,
  type Step,
} from './children-common';
import type { ImagesInput } from './children-schemas';
import { remapPlanIssues } from './schemas';

const SPEC = TRANSLATABLE.productImage;

/** Зображення товару: рядки, `alt` за мовами, мовні перевизначення файлу. */
export async function planImages(
  ctx: ChildCtx,
  input: ImagesInput | undefined,
): Promise<Step & { keys: string[] }> {
  const upserts = input?.upsert ?? [];
  const removes = input?.remove ?? [];
  const keys = upserts.flatMap((u) => [
    u.storageKey,
    ...Object.values(u.overrides ?? {}).filter((k) => k !== null),
  ]);
  if (upserts.length === 0 && removes.length === 0) return { ...NOOP, keys };
  const at = (i: number, ...rest: (string | number)[]) => [
    'images',
    'upsert',
    i,
    ...rest,
  ];
  requireDistinct(
    upserts.map((u) => u.id),
    (i) => at(i, 'id'),
  );
  const removing = new Set(removes);
  upserts.forEach((u, i) => {
    if (removing.has(u.id)) throw fail(at(i, 'id'), 'invalid_value');
    if (u.modificationId && !ctx.modificationIds.has(u.modificationId))
      throw fail(at(i, 'modificationId'), 'invalid_value');
    requireLocales(ctx, u.alt, (l) => at(i, 'alt', l));
    requireLocales(ctx, u.overrides, (l) => at(i, 'overrides', l));
    // Для основної мови файл — сам `storageKey`; перевизначення було б другим джерелом.
    if (u.overrides?.[ctx.primary] !== undefined)
      throw fail(at(i, 'overrides', ctx.primary), 'invalid_value');
  });
  if (upserts.length > 0) {
    const foreign = await ctx.db.execute<{ id: string }>(
      sql`select id from public.product_images
           where id = any(${uuidArray(upserts.map((u) => u.id))})
             and product_id <> ${ctx.productId}`,
    );
    const bad = new Set(foreign.rows.map((r) => r.id));
    upserts.forEach((u, i) => {
      if (bad.has(u.id)) throw fail(at(i, 'id'), 'invalid_value');
    });
  }
  const stored = await loadTranslations(
    ctx.db,
    SPEC,
    upserts.map((u) => u.id),
  );
  const prepared = upserts.map((u, i) => {
    const all = stored.get(u.id) ?? new Map();
    const byLocale = new Map(all);
    byLocale.delete(ctx.primary);
    const patch = new Map<string, Record<string, string | null>>();
    for (const [l, alt] of Object.entries(u.alt ?? {}))
      patch.set(l, { ...patch.get(l), alt });
    for (const [l, k] of Object.entries(u.overrides ?? {}))
      patch.set(l, { ...patch.get(l), storage_key: k });
    const plan = remapPlanIssues(['images', 'upsert', i], () =>
      planTranslationWrite({
        spec: SPEC,
        current: { source: all.get(ctx.primary) ?? null, byLocale },
        primary: ctx.primary,
        patch,
        hash: sourceFieldHash,
      }),
    );
    return { u, plan };
  });

  return {
    keys,
    async apply() {
      const { db, productId } = ctx;
      if (removes.length > 0)
        await db.execute(sql`delete from public.product_images
          where product_id = ${productId} and id = any(${uuidArray(removes)})`);
      for (const { u, plan } of prepared) {
        const row = {
          modificationId: u.modificationId ?? null,
          storageKey: u.storageKey,
          sortOrder: u.sortOrder,
        };
        await db
          .insert(productImages)
          .values({ id: u.id, productId, ...row })
          .onConflictDoUpdate({ target: productImages.id, set: row });
        await applyTranslationPlan(db, SPEC, u.id, plan);
      }
    },
  };
}
