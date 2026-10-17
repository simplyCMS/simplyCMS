// Адреси інших мов і проєкція тексту для графа товару (М1, Task 14, І23): фікстура
// доводиться до стану, який лишають команди, — інакше тести вітрини й звірки бачили б
// товар, якого команди створити не можуть (без адреси в мові й без рядка проєкції).
// SQL — свідома друга копія `catalog-projection/expected.ts`: її еквівалентність
// доводить `catalog-projection.test.ts` (звірка після фікстури: `mismatched: 0`).
import { PRIMARY } from './product-graph-rows';
import { idSql, lit, type Id } from './product-graph-types';

const FIELDS = [
  'name',
  'short_description',
  'description',
  'meta_title',
  'meta_description',
];

/** Поточна адреса товару в кожній `draft`/`published` мові, крім основної (її пише граф). */
export const otherLocalePathsSql = (productId: Id, path: string): string => `
  insert into public.url_paths (id, locale, path, product_id, is_current)
  select gen_random_uuid(), l.code, ${lit(path)}, ${idSql(productId)}, true
    from public.languages l
   where l.status in ('draft', 'published') and not l.is_default`;

/** Рядки проєкції товару для всіх активних мов (джерело — переклад основної мови). */
export const projectionSql = (productId: Id): string => {
  const coalesced = FIELDS.map((f) => `coalesce(t.${f}, s.${f})`).join(', ');
  const translated = FIELDS.map(
    (f) => `(s.${f} is null or t.${f} is not null)`,
  ).join(' and ');
  return `
  insert into public.catalog_product_texts
    (product_id, locale, ${FIELDS.join(', ')}, path, is_translated)
  select p.id, l.code, ${coalesced}, u.path, (t.product_id is not null and ${translated})
    from public.products p
    join public.languages l on l.status in ('draft', 'published')
    join public.url_paths u on u.product_id = p.id and u.locale = l.code and u.is_current
    join public.product_translations s on s.product_id = p.id and s.locale = ${PRIMARY}
    left join public.product_translations t on t.product_id = p.id and t.locale = l.code
   where p.id = ${idSql(productId)} and coalesce(t.name, s.name) is not null`;
};
