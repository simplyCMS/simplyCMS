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

/**
 * СПІЛЬНИЙ варіант того самого замка (`pg_advisory_xact_lock_shared`): ключ
 * хешується так само, тож він конфліктує з ексклюзивним `advisoryXactLock` на
 * тому ж ключі, але не з іншими спільними. Беруть операції, що лише
 * приєднуються до загального набору (наприклад, створення сутності під
 * `LOCK_KEYS.languagesSet`), а ексклюзивний власник — зміна самого набору —
 * чекає завершення всіх таких транзакцій. Лок береться ПЕРШИМ запитом
 * транзакції; знімається на COMMIT/ROLLBACK.
 */
export async function advisoryXactLockShared(
  db: ActorDb,
  key: string,
): Promise<void> {
  await db.execute(
    sql`select pg_advisory_xact_lock_shared(hashtextextended(${key}, 0))`,
  );
}
