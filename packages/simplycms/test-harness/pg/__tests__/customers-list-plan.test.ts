// Е8-Р3 (Е6г-5), рев'ю F1: keyset-індекс `users_created_ms_id_idx` корисний,
// лише коли вираз порядку в запиті списку покупців збігається з виразом
// індексу. Тест робить EXPLAIN САМОГО запиту `listCustomersOp`
// (`buildCustomersListSql`), а не його копії: зміна виразу в `list-sql.ts` без
// зміни індексу (чи навпаки) робить його червоним.
import { describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { withActor } from 'simplycms/db';
import { buildCustomersListSql } from 'simplycms/admin-server/impl';
import * as F from './fixtures/customer-categories';

describe('список покупців: план запиту тримається на keyset-індексі', () => {
  F.useCustomersDb('simplycms_customers_plan');

  /** EXPLAIN запиту; seqscan вимкнено, щоб на порожніх таблицях вирішувала придатність індексу. */
  const plan = (query: ReturnType<typeof buildCustomersListSql>) =>
    withActor({ role: 'app_admin' }, async (db) => {
      await db.execute(sql`set local enable_seqscan = off`);
      const result = await db.execute<{ 'QUERY PLAN': string }>(
        sql`explain ${query}`,
      );
      return result.rows.map((row) => row['QUERY PLAN']).join('\n');
    });

  it('перша сторінка і сторінка з курсором беруть users_created_ms_id_idx', async () => {
    const first = await plan(buildCustomersListSql({}, 50));
    expect(first).toContain('users_created_ms_id_idx');
    const next = await plan(
      buildCustomersListSql(
        { cursor: { createdAt: new Date(), id: crypto.randomUUID() } },
        50,
      ),
    );
    expect(next).toContain('users_created_ms_id_idx');
  });
});
