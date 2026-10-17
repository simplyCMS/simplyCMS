import { sql } from 'drizzle-orm';
import type { ActorDb } from 'simplycms/db';
import { isTranslatedForSeo } from 'simplycms/domain/translations';
import { TRANSLATABLE } from 'simplycms/translations';
import { TEXT_FIELDS, col } from './expected';

const SPEC = TRANSLATABLE.product;
const PAGE = 500;

export interface MismatchKey {
  readonly productId: string;
  readonly locale: string;
}

export const keyOf = (k: MismatchKey) => `${k.productId}\u0000${k.locale}`;

export interface FindOptions {
  /** Лише ці товари (повторна перевірка після виправлення). */
  readonly productIds?: readonly string[];
  /** Лише ця мова (повнота мови). */
  readonly locale?: string;
  /** Скільки розбіжностей зібрати; без ліміту — усі. */
  readonly limit?: number;
}

/**
 * Паритет SQL-предиката `is_translated` з TS `isTranslatedForSeo`: збережений
 * прапорець мусить збігатися з доменним правилом. Для плоских полів їх зводить
 * CHECK у БД; для rich-поля SQL бачить лише `IS NULL`, тож `<p></p>`, вставлений в
 * обхід команди, дав би тут розбіжність — її не можна мовчки пропустити.
 * Читаємо rich-поля цілком, плоскі — лише як «є/немає» (CHECK гарантує непорожнє).
 */
export async function parityMismatches(
  db: ActorDb,
  o: FindOptions,
  budget: number,
): Promise<MismatchKey[]> {
  const rich = SPEC.richHtml as readonly string[];
  const pick = (alias: string) =>
    sql.join(
      TEXT_FIELDS.map((f) =>
        rich.includes(f)
          ? sql`${sql.raw(alias)}.${col(f)} as ${sql.raw(`${alias}_${f}`)}`
          : sql`(${sql.raw(alias)}.${col(f)} is not null) as ${sql.raw(`${alias}_${f}`)}`,
      ),
      sql`, `,
    );
  const out: MismatchKey[] = [];
  let after: MismatchKey | null = null;
  while (out.length < budget) {
    const res: { rows: Record<string, unknown>[] } = await db.execute(sql`
      select c.product_id, c.locale, c.is_translated, t.product_id is not null as has_t,
             ${pick('s')}, ${pick('t')}
        from public.catalog_product_texts c
        join public.product_translations s
          on s.product_id = c.product_id
         and s.locale = (select code from public.languages where is_default)
        left join public.product_translations t
          on t.product_id = c.product_id and t.locale = c.locale
       where true
         ${o.locale ? sql`and c.locale = ${o.locale}` : sql``}
         ${
           o.productIds
             ? sql`and c.product_id in (${sql.join(
                 o.productIds.map((id) => sql`${id}::uuid`),
                 sql`, `,
               )})`
             : sql``
         }
         ${after ? sql`and (c.product_id, c.locale) > (${after.productId}::uuid, ${after.locale})` : sql``}
       order by c.product_id, c.locale
       limit ${PAGE}`);
    for (const r of res.rows) {
      const values = (alias: string) =>
        Object.fromEntries(
          TEXT_FIELDS.map((f) => {
            const v = r[`${alias}_${f}`];
            // Плоске поле повернулось булевим «є/немає»: підміняємо маркером тексту.
            return [
              f,
              typeof v === 'boolean' ? (v ? 'x' : null) : (v as string | null),
            ];
          }),
        );
      const want = isTranslatedForSeo(
        SPEC,
        { values: values('s') },
        r.has_t ? { values: values('t') } : null,
      );
      after = { productId: String(r.product_id), locale: String(r.locale) };
      if (want !== r.is_translated) out.push(after);
    }
    if (res.rows.length < PAGE) break;
  }
  return out;
}
