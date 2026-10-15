import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { advisoryXactLock, advisoryXactLockShared } from '../advisory-lock';
import type { ActorDb } from '../with-actor';

/** Фейковий `ActorDb`: збирає SQL, який передали в `execute`. */
function capture(): { db: ActorDb; sqls: SQL[] } {
  const sqls: SQL[] = [];
  const db = {
    execute: async (query: SQL) => {
      sqls.push(query);
      return [];
    },
  } as unknown as ActorDb;
  return { db, sqls };
}

describe('транзакційні advisory-замки', () => {
  it('ексклюзивний і спільний хешують ключ однаково, відрізняються лише режимом', async () => {
    const { db, sqls } = capture();
    await advisoryXactLock(db, 'k-test');
    await advisoryXactLockShared(db, 'k-test');
    const [exclusive, shared] = sqls.map((q) => new PgDialect().sqlToQuery(q));
    expect(exclusive!.sql).toContain(
      'pg_advisory_xact_lock(hashtextextended($1, 0))',
    );
    expect(shared!.sql).toContain(
      'pg_advisory_xact_lock_shared(hashtextextended($1, 0))',
    );
    expect(exclusive!.params).toEqual(['k-test']);
    expect(shared!.params).toEqual(['k-test']);
  });
});
