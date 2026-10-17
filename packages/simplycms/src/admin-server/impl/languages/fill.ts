import { sql } from 'drizzle-orm';
import { copyPathsForLocale, copyTokensForLocale } from 'simplycms/addressing';
import { buildMissingProjection } from 'simplycms/catalog-projection';
import { lockProductRootsShared, type ActorDb } from 'simplycms/db';

/** Розмір пакета за виклик: довга транзакція на 10k сутностей тримала б локи. */
export const FILL_BATCH = 500;

/**
 * Товари, яким у `code` ще є що заповнювати (адреса, токен модифікації, проєкція),
 * до `batch` штук за id. Умови дзеркалять вибірки етапів (`copy.ts`, `expectedRows`):
 * що тут «потребує роботи», те етап справді зробить.
 */
async function pendingProducts(
  db: ActorDb,
  code: string,
  batch: number,
): Promise<string[]> {
  const primary = sql`(select code from public.languages where is_default)`;
  const res = await db.execute<{ id: string }>(sql`
    select p.id from public.products p
     where (
         -- адреса: є в основній мові, немає в цій
         (exists (
            select 1 from public.url_paths a
             where a.product_id = p.id and a.locale = ${primary} and a.is_current)
          and not exists (
            select 1 from public.url_paths t
             where t.product_id = p.id and t.locale = ${code} and t.is_current))
         -- токен модифікації: є в основній мові, немає в цій
         or exists (
           select 1 from public.slug_tokens s
            where s.scope_id = p.id and s.locale = ${primary} and s.is_current
              and s.token_kind = 'modification'
              and not exists (
                select 1 from public.slug_tokens t
                 where t.modification_id = s.modification_id
                   and t.locale = ${code} and t.is_current))
         -- проєкція: мова активна, рядка немає, а адреса в мові є або з'явиться
         or (exists (select 1 from public.languages l
                      where l.code = ${code} and l.status in ('draft', 'published'))
             and exists (
               select 1 from public.url_paths u
                where u.product_id = p.id and u.is_current
                  and u.locale in (${code}, ${primary}))
             and not exists (
               select 1 from public.catalog_product_texts c
                where c.product_id = p.id and c.locale = ${code}))
       )
     order by p.id
     limit ${batch}`);
  return res.rows.map((r) => r.id);
}

/**
 * Один пакет заповнення мови: адреси, токени, потім проєкція тексту (вона йде
 * останньою: будується з адрес, щойно створених у цій транзакції). Ідемпотентне —
 * копіюються лише сутності без поточного запису в мові; наявні рядки проєкції fill
 * не перезаписує (їх оновлює лише команда, І23). Для мови `disabled` проєкції нема.
 *
 * 🔴 Пакет серіалізується на КОРЕНЯХ товарів: спершу `FOR SHARE ORDER BY id` для всього
 * пакета (один раз на усі три етапи — єдиний порядок), далі етапи працюють лише з
 * цими товарами. Видаляч модифікацій тримає той самий корінь (`NO KEY UPDATE`), тож
 * fill не бере дочірніх рядків у протилежному порядку (40P01) і не вставляє FK на
 * видалене (23503); товар, що зник до замка, пропускається.
 * `done`: кандидатів менше за ліміт; клієнт кличе, доки `done` не стане `true`.
 * Остаточну істину дає `completeness`.
 */
export async function fillBatch(
  db: ActorDb,
  code: string,
  batch: number = FILL_BATCH,
): Promise<{ inserted: number; done: boolean }> {
  const pending = await pendingProducts(db, code, batch);
  const roots = await lockProductRootsShared(db, pending);
  if (roots.length === 0) return { inserted: 0, done: pending.length < batch };
  const paths = await copyPathsForLocale(db, code, batch, roots);
  const tokens = await copyTokensForLocale(db, code, batch, roots);
  const texts = await buildMissingProjection(db, code, batch, roots);
  return {
    inserted: paths + tokens + texts,
    // Етап міг упертися в ліміт (багато модифікацій в одному товарі) — тоді ще не все.
    done:
      pending.length < batch &&
      paths < batch &&
      tokens < batch &&
      texts < batch,
  };
}
