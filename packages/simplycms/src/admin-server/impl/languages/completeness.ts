import { sql } from 'drizzle-orm';
import type { ActorDb } from 'simplycms/db';

export interface Completeness {
  readonly complete: boolean;
  readonly missingPaths: number;
  readonly missingTokens: number;
  /** Проєкція мови з'явиться з Task 14; до того — завжди 0. */
  readonly missingProjection: number;
}

/**
 * Повнота мови (І16): кожен товар має поточну адресу, кожна модифікація —
 * поточний токен у цій мові. Публікація без повноти дала б 404 на сторінках,
 * які в основній мові існують. Рахуємо від самих сутностей, а не від адрес
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
  const missingProjection = 0;
  return {
    complete: missingPaths + missingTokens + missingProjection === 0,
    missingPaths,
    missingTokens,
    missingProjection,
  };
}
