import { sql } from 'drizzle-orm';
import { countProjectionMismatches } from 'simplycms/catalog-projection';
import type { ActorDb } from 'simplycms/db';

export interface Completeness {
  readonly complete: boolean;
  readonly missingPaths: number;
  readonly missingTokens: number;
  /**
   * Розбіжності проєкції тексту мови із джерелом: відсутні + застарілі + зайві
   * (той самий розрахунок, що `reconcileProductTexts`, лише читання). Для мови
   * `disabled` проєкції немає за побудовою — 0.
   */
  readonly missingProjection: number;
}

/**
 * Повнота мови (І16): кожен товар має поточну адресу, кожна модифікація —
 * поточний токен у цій мові, проєкція тексту товарів збігається з джерелом.
 * Публікація без повноти дала б 404 на сторінках, які в основній мові існують. Рахуємо від самих сутностей, а не від адрес
 * основної мови: сутність без адреси в основній теж є дефектом повноти.
 */
export async function completeness(
  db: ActorDb,
  code: string,
): Promise<Completeness> {
  const res = await db.execute<{ paths: string; tokens: string }>(sql`
    select
      (select count(*) from public.products p
        where not exists (
          select 1 from public.url_paths t
           where t.locale = ${code} and t.product_id = p.id and t.is_current)
      ) as paths,
      (select count(*) from public.product_modifications m
        where not exists (
          select 1 from public.slug_tokens t
           where t.locale = ${code} and t.modification_id = m.id and t.is_current)
      ) as tokens`);
  const missingPaths = Number(res.rows[0]?.paths ?? 0);
  const missingTokens = Number(res.rows[0]?.tokens ?? 0);
  const missingProjection = await countProjectionMismatches(db, code);
  return {
    complete: missingPaths + missingTokens + missingProjection === 0,
    missingPaths,
    missingTokens,
    missingProjection,
  };
}
