import { eq, sql } from 'drizzle-orm';
import type { ActorDb } from 'simplycms/db';
import type { TranslationWritePlan } from 'simplycms/domain/translations';
import { products } from 'simplycms/schema';
import { fieldToWire } from 'simplycms/translations';
import type { ProductBase } from './schemas';

/** Старі колонки основної мови (М1-TEMP): значення плану → ключі drizzle-таблиці `products`. */
export function mirrorColumns(
  plan: TranslationWritePlan,
  primary: string,
): Record<string, string | null> {
  const mirror: Record<string, string | null> = {};
  const upsert = plan.upserts.find((u) => u.locale === primary);
  // М1-TEMP: зноситься в Task 17
  for (const [field, value] of Object.entries(upsert?.values ?? {}))
    mirror[fieldToWire(field)] = value;
  return mirror;
}

/**
 * Збільшення версії кореня + запис бази + (М1-TEMP) дзеркало у старі колонки.
 * Версія росте на КОЖНІЙ команді агрегата в тій самій транзакції (майстер §3.4).
 *
 * М1-TEMP: зноситься в Task 17 — тексти основної мови дзеркаляться в
 * `products.{name,short_description,…}`, адреса основної мови — у `products.slug`
 * (NOT NULL до Task 17), бо старі читачі вітрини/адмінки ще читають їх.
 */
export async function bumpProduct(
  db: ActorDb,
  id: string,
  opts: {
    base?: ProductBase;
    plan?: TranslationWritePlan;
    primary?: string;
    slug?: string;
  } = {},
): Promise<number> {
  const mirror =
    opts.plan && opts.primary ? mirrorColumns(opts.plan, opts.primary) : {};
  const [row] = await db
    .update(products)
    .set({
      ...opts.base,
      ...mirror,
      // М1-TEMP: зноситься в Task 17
      ...(opts.slug === undefined ? {} : { slug: opts.slug }),
      version: sql`${products.version} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(products.id, id))
    .returning({ version: products.version });
  return row!.version;
}
