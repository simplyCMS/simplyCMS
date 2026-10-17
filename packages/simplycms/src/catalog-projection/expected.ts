import { sql, type SQL } from 'drizzle-orm';
import { TRANSLATABLE } from 'simplycms/translations';

// «Очікуваний» стан проєкції `catalog_product_texts` — ЄДИНИЙ SELECT, з якого
// беруть refresh, етап fill і звірка (І23): три читачі однієї істини не можуть
// розійтись між собою, лише проєкція від неї.

const SPEC = TRANSLATABLE.product;
const IDENT = /^[a-z][a-z0-9_]*$/;

/** Ідентифікатор поля з реєстру в SQL; рубіж на випадок помилки реєстру. */
export const col = (name: string): SQL => {
  if (!IDENT.test(name))
    throw new Error(
      `[simplycms/catalog-projection] недопустиме поле «${name}»`,
    );
  return sql.raw(name);
};

/** Поля тексту проєкції: перекладні поля товару (порядок реєстру). */
export const TEXT_FIELDS: readonly string[] = SPEC.fields;

/** Усі колонки проєкції, окрім ключа й `updated_at`, у порядку INSERT. */
export const VALUE_COLUMNS: readonly string[] = [
  ...TEXT_FIELDS,
  'path',
  'is_translated',
];

export interface Scope {
  readonly productIds?: readonly string[];
  readonly locales?: readonly string[];
}

const list = (values: readonly string[], cast = ''): SQL =>
  sql.join(
    values.map((v) => sql`${v}${sql.raw(cast)}`),
    sql`, `,
  );

/**
 * SELECT очікуваних рядків: (товар × мова `draft`/`published`) з поточною адресою
 * в цій мові й рядком джерела (основна мова) з назвою.
 *  - текст = `coalesce(мова, джерело)` для кожного поля (fallback);
 *  - `is_translated` = рядок мови є і кожне поле, непорожнє в джерелі, непорожнє
 *    й у мові. Порожнє зберігається як `NULL` (§3.4), тож предикат — `IS NULL`;
 *    плоскі поля страхує CHECK у БД, rich — звірка (`reconcile.ts`);
 *  - INNER JOIN на адресу: товар без поточної адреси в мові рядка не має (П3) —
 *    completeness рахує це як `missingPaths`.
 * Набір мов читається в цьому ж запиті, тож викликач мусить тримати спільний
 * замок `languages-set` (інакше мова може змінитись між замком і запитом).
 */
export function expectedRows(scope: Scope = {}): SQL {
  const texts = sql.join(
    TEXT_FIELDS.map(
      (f) => sql`coalesce(t.${col(f)}, s.${col(f)}) as ${col(f)}`,
    ),
    sql`, `,
  );
  const translated = sql.join(
    TEXT_FIELDS.map(
      (f) => sql`(s.${col(f)} is null or t.${col(f)} is not null)`,
    ),
    sql` and `,
  );
  const filters: SQL[] = [];
  if (scope.productIds)
    filters.push(sql`p.id in (${list(scope.productIds, '::uuid')})`);
  if (scope.locales) filters.push(sql`l.code in (${list(scope.locales)})`);
  const where =
    filters.length > 0 ? sql` and ${sql.join(filters, sql` and `)}` : sql``;
  return sql`
    select p.id as product_id, l.code as locale, ${texts}, u.path as path,
           (t.product_id is not null and ${translated}) as is_translated
      from public.products p
      join public.languages l on l.status in ('draft', 'published')
      join public.url_paths u
        on u.product_id = p.id and u.locale = l.code and u.is_current
      join public.product_translations s
        on s.product_id = p.id
       and s.locale = (select code from public.languages where is_default)
      left join public.product_translations t
        on t.product_id = p.id and t.locale = l.code
     where coalesce(t.name, s.name) is not null${where}`;
}

/** Список колонок для INSERT/SELECT проєкції: `product_id, locale, значення…`. */
export const columnList = (prefix = ''): SQL =>
  sql.join(
    ['product_id', 'locale', ...VALUE_COLUMNS].map((c) =>
      sql.raw(`${prefix}${c}`),
    ),
    sql`, `,
  );
