import { sql } from 'drizzle-orm';
import type { ActorDb } from './with-actor';

/**
 * Транзакційний advisory-lock за рядковим ключем — ЄДИНА SQL-реалізація
 * (Е6в-15 ред.2). `lockCatalogTarget` адмінки й локи `commerce`
 * (`customerCategoryLock`) кличуть саме її: два різні хешування одного
 * ключа означали б два різні локи, тобто жодного серіалізування.
 *
 * 🔴 Хешування — `hashtextextended(key, 0)` байт-у-байт як було в
 * `lockCatalogTarget` до переїзду: зміна функції чи seed мовчки розвела б
 * ключі з хелперами харнеса (`holdAdvisoryLock`) і зі старими локами.
 * xact-варіант знімається на COMMIT/ROLLBACK сам — сумісний із pgbouncer
 * transaction-mode (спайк B5). Лок береться ПЕРШИМ запитом транзакції.
 */
export async function advisoryXactLock(
  db: ActorDb,
  key: string,
): Promise<void> {
  await db.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`,
  );
}
