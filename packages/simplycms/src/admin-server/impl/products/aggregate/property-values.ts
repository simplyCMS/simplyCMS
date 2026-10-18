import { sql } from 'drizzle-orm';
import { planTranslationWrite } from 'simplycms/domain/translations';
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
import type { PropertyValuesInput } from './children-schemas';
import { checkShape, loadKnownProperties } from './property-value-checks';
import { writeValueRow, type ValueTable } from './property-value-write';
import { assertRowsOwned } from './property-value-owned';
import { remapPlanIssues } from './schemas';

type Upsert = NonNullable<PropertyValuesInput['upsert']>[number];

const tableOf = (u: Upsert): ValueTable =>
  u.modificationId ? 'modification' : 'product';
const specOf = (t: ValueTable) =>
  t === 'modification'
    ? TRANSLATABLE.modificationPropertyValue
    : TRANSLATABLE.productPropertyValue;

/**
 * Значення властивостей товару й модифікації (Р18). Форму вводу (колонка за
 * `kind`, `text` лише для тексту) команда звіряє сама; тип властивості й власника
 * опції — складені FK у БД (І6/І7), чию відмову `writeValueRow` перекладає в помилку
 * поля, а один рядок скаляра — частковий UNIQUE (І8).
 */
export async function planPropertyValues(
  ctx: ChildCtx,
  input: PropertyValuesInput | undefined,
): Promise<Step> {
  const upserts = input?.upsert ?? [];
  const removes = input?.remove ?? [];
  if (upserts.length === 0 && removes.length === 0) return NOOP;
  const at = (i: number, ...rest: string[]) => [
    'propertyValues',
    'upsert',
    i,
    ...rest,
  ];
  requireDistinct(
    upserts.map((u) => u.id),
    (i) => at(i, 'id'),
  );
  const removing = new Set(removes);
  const known = await loadKnownProperties(ctx, upserts);
  upserts.forEach((u, i) => {
    if (removing.has(u.id)) throw fail(at(i, 'id'), 'invalid_value');
    if (u.modificationId && !ctx.modificationIds.has(u.modificationId))
      throw fail(at(i, 'modificationId'), 'invalid_value');
    requireLocales(ctx, u.text, (l) => at(i, 'text', l));
    checkShape(u, known, (...rest) => at(i, ...rest));
  });
  await assertRowsOwned(ctx, upserts, removing);

  const stored = new Map<
    ValueTable,
    Awaited<ReturnType<typeof loadTranslations>>
  >();
  for (const t of ['product', 'modification'] as const)
    stored.set(
      t,
      await loadTranslations(
        ctx.db,
        specOf(t),
        upserts.filter((u) => tableOf(u) === t).map((u) => u.id),
      ),
    );
  const prepared = upserts.map((u, i) => {
    const all = stored.get(tableOf(u))!.get(u.id) ?? new Map();
    const byLocale = new Map(all);
    byLocale.delete(ctx.primary);
    const plan = remapPlanIssues(['propertyValues', 'upsert', i, 'text'], () =>
      planTranslationWrite({
        spec: specOf(tableOf(u)),
        current: { source: all.get(ctx.primary) ?? null, byLocale },
        primary: ctx.primary,
        patch: new Map(
          Object.entries(u.text ?? {}).map(([l, v]) => [l, { value: v }]),
        ),
        hash: sourceFieldHash,
      }),
    );
    // І5: текстове значення має текст основної мови. Тригер джерела відмовив би лише
    // на COMMIT загальним 23514, тут — рання помилка поля (400).
    if (u.kind === 'text') {
      const sent = plan.upserts.find((x) => x.locale === ctx.primary)?.values;
      const after =
        sent && 'value' in sent
          ? sent.value
          : all.get(ctx.primary)?.values.value;
      if (!after) throw fail(at(i, 'text', ctx.primary), 'too_small');
    }
    return { u, i, plan };
  });

  return {
    async apply() {
      const { db } = ctx;
      if (removes.length > 0) {
        await db.execute(sql`delete from public.product_property_values
          where product_id = ${ctx.productId} and id = any(${uuidArray(removes)})`);
        await db.execute(sql`delete from public.modification_property_values
          where id = any(${uuidArray(removes)}) and modification_id in
            (select id from public.product_modifications where product_id = ${ctx.productId})`);
      }
      for (const { u, i, plan } of prepared) {
        const table = tableOf(u);
        await writeValueRow(db, ctx.productId, table, u, (...rest) =>
          at(i, ...rest),
        );
        if (u.kind === 'text')
          await applyTranslationPlan(db, specOf(table), u.id, plan);
        // Не-text значення переклад не має: після зміни типу залишки прибираємо.
        else
          await db.execute(
            sql`delete from ${sql.raw(specOf(table).table)} where value_id = ${u.id}`,
          );
      }
    },
  };
}
