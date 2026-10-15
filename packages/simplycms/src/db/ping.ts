import { sql } from 'drizzle-orm';
import { withActor } from './with-actor';

/**
 * Liveness-проба Postgres: `select 1` під роллю вітрини через `withActor`.
 * Окремий помічник, щоб роут health не кликав `withActor` сам (І25: дані — не
 * з роутів), а проба лишалась тим самим каналом, що й увесь код вітрини.
 * Кидає, якщо БД недоступна.
 */
export async function pingDatabase(): Promise<void> {
  await withActor({ role: 'app_user' }, (db) => db.execute(sql`select 1`));
}
