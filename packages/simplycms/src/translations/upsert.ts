import { sql, type SQL } from 'drizzle-orm';
import { ValidationError } from 'simplycms/contracts/domain-errors';
import { AdminNotFoundError } from 'simplycms/contracts/domain-errors';
import type { ActorDb } from 'simplycms/db';
import type { TranslationWritePlan } from 'simplycms/domain/translations';
import { primaryLocaleCode } from './read';
import { assertIdent, type TranslatableEntity } from './specs';

/**
 * Застосовує план запису (`planTranslationWrite`): по `INSERT … ON CONFLICT
 * (<fk>, locale) DO UPDATE` на кожну надіслану мову, лише НАДІСЛАНІ колонки
 * (ненадіслані лишаються як були) і повний набір `source_hashes`, який уже
 * зібрав план. DELETE тут немає за побудовою (І11): мова поза запитом
 * недоторкана, а видалення мови — окрема `deleteTranslation`.
 * `extra` — службові колонки рядка (напр. `product_id` модифікації).
 */
export async function applyTranslationPlan(
  db: ActorDb,
  spec: TranslatableEntity,
  entityId: string,
  plan: TranslationWritePlan,
  extra: Readonly<Record<string, unknown>> = {},
): Promise<void> {
  const fk = assertIdent(spec.fk);
  const table = sql.raw(assertIdent(spec.table));
  const extraCols = Object.keys(extra).map(assertIdent);
  for (const u of plan.upserts) {
    const cols = Object.keys(u.values).map((c) => {
      if (!spec.fields.includes(c))
        throw new Error(
          `[simplycms/translations] поле «${c}» поза специфікацією`,
        );
      return assertIdent(c);
    });
    const names = [fk, 'locale', ...extraCols, ...cols, 'source_hashes'];
    const values: SQL[] = [
      sql`${entityId}::uuid`,
      sql`${u.locale}`,
      ...extraCols.map((c) => sql`${extra[c]}`),
      ...cols.map((c) => sql`${u.values[c]}`),
      sql`${JSON.stringify(u.sourceHashes)}::jsonb`,
    ];
    const updates = [...cols, 'source_hashes'].map(
      (c) => sql`${sql.raw(c)} = excluded.${sql.raw(c)}`,
    );
    await db.execute(sql`
      insert into ${table} (${sql.join(
        names.map((n) => sql.raw(n)),
        sql`, `,
      )})
      values (${sql.join(values, sql`, `)})
      on conflict (${sql.raw(fk)}, locale) do update
        set ${sql.join(updates, sql`, `)}, updated_at = now()`);
  }
}

/**
 * Видаляє переклад однієї мови. Основну мову видаляти не можна: вона —
 * джерело (майстер §3.4). Рядка немає → `AdminNotFoundError`.
 */
export async function deleteTranslation(
  db: ActorDb,
  spec: TranslatableEntity,
  entityId: string,
  locale: string,
): Promise<void> {
  if (locale === (await primaryLocaleCode(db)))
    throw new ValidationError([{ path: ['locale'], code: 'invalid_value' }]);
  const res = await db.execute(sql`
    delete from ${sql.raw(assertIdent(spec.table))}
     where ${sql.raw(assertIdent(spec.fk))} = ${entityId}::uuid and locale = ${locale}`);
  if (res.rowCount === 0) throw new AdminNotFoundError('переклад');
}
