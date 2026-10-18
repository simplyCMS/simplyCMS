// Читальні SQL-вирази графа товару для фікстур і перевірок харнесу (М1, Task 17): у
// `products`/`product_modifications` колонок `slug`/`name`/`images` немає — природний
// ключ товару тепер його поточна адреса ОСНОВНОЇ мови, модифікації — токен основної мови
// в межах товару, назва — переклад основної мови, фото — рядки `product_images`.
// Скалярні підзапити, а не JOIN-и: їх можна підставити в наявні запити без зміни FROM.
import { PRIMARY } from './product-graph-rows';

/** id товару за поточною адресою основної мови; `slug` — SQL-вираз (`'x'`, `$1`). */
export const productIdBySlug = (slug: string): string =>
  `(select u.product_id from public.url_paths u
     where u.is_current and u.product_id is not null and u.locale = ${PRIMARY} and u.path = ${slug})`;

/** id модифікації товару `product` (SQL-вираз id) за поточним токеном основної мови. */
export const modificationIdBySlug = (product: string, slug: string): string =>
  `(select t.modification_id from public.slug_tokens t
     where t.is_current and t.scope_id = ${product} and t.locale = ${PRIMARY} and t.slug = ${slug})`;

/** Поточна адреса основної мови товару `p` (вираз id товару, напр. `p.id`). */
export const productSlugOf = (p: string): string =>
  `(select u.path from public.url_paths u
     where u.product_id = ${p} and u.is_current and u.locale = ${PRIMARY})`;

/** Назва товару основною мовою. */
export const productNameOf = (p: string): string =>
  `(select t.name from public.product_translations t
     where t.product_id = ${p} and t.locale = ${PRIMARY})`;

/** Поточний токен основної мови модифікації `m` (вираз id модифікації). */
export const modificationSlugOf = (m: string): string =>
  `(select t.slug from public.slug_tokens t
     where t.modification_id = ${m} and t.is_current and t.locale = ${PRIMARY})`;

/** Назва модифікації основною мовою. */
export const modificationNameOf = (m: string): string =>
  `(select t.name from public.product_modification_translations t
     where t.modification_id = ${m} and t.locale = ${PRIMARY})`;

/** Кількість фото товару (без фото модифікацій). */
export const productImageCountOf = (p: string): string =>
  `(select count(*)::int from public.product_images i
     where i.product_id = ${p} and i.modification_id is null)`;
