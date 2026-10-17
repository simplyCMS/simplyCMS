// Негативні контролі очікувача блокування (М1, Task 14б): дерево очікування рахує лише тих,
// хто стоїть на тримачі (прямо чи через інших), а строгий режим не проходить без блокування.
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { useAddressingDb } from './fixtures/addressing-db';
import {
  blockedTreeSize,
  hold,
  until,
  waitForBlockedTree,
  waitForBlockedTreeOrSettled,
} from './fixtures/lock-holders';

describe('очікувач блокування за деревом від тримача (14б)', () => {
  const db = useAddressingDb('simplycms_lock_holders');
  const lock = (key: string) =>
    sql.raw(`select pg_advisory_xact_lock(hashtextextended('${key}', 0))`);
  const holdKey = (key: string) => hold(db, (d) => d.execute(lock(key)));
  /** Очікувач: транзакція, що бере ті самі замки по черзі; `then` — після них. */
  const waiter = (...keys: string[]) =>
    db.admin(async (d) => {
      for (const k of keys) await d.execute(lock(k));
    });
  const quick = { deadlineMs: 400, stepMs: 20 };

  it('строгий режим без конфлікту: ніхто не став на тримача -> «не дочекались»', async () => {
    const t0 = holdKey(`solo-${Date.now()}`);
    await until('T0 тримає замок', t0.acquired);
    await expect(waitForBlockedTree(db, t0, 1, quick)).rejects.toThrow(
      /не дочекались/,
    );
    t0.release();
    await t0.done;
  });

  it('нестрогий режим без конфлікту закінчується завершенням заданого промісу', async () => {
    const t0 = holdKey(`loose-${Date.now()}`);
    await until('T0 тримає замок', t0.acquired);
    const other = Promise.resolve('ok');
    await expect(
      waitForBlockedTreeOrSettled(db, t0, 1, [other], quick),
    ).resolves.toBeUndefined();
    t0.release();
    await t0.done;
  });

  it('чужа пара тримач/очікувач на ІНШОМУ ключі не зараховується; наш очікувач — зараховується', async () => {
    const ours = `ours-${Date.now()}`;
    const foreign = `foreign-${Date.now()}`;
    const foreignHolder = holdKey(foreign);
    await until('чужий тримач', foreignHolder.acquired);
    const foreignWaiter = waiter(foreign);
    const t0 = holdKey(ours);
    await until('T0 тримає замок', t0.acquired);
    // Чужий очікувач точно заблокований (на своєму тримачі), але не на нашому.
    await waitForBlockedTree(db, foreignHolder, 1);
    await expect(waitForBlockedTree(db, t0, 1, quick)).rejects.toThrow(
      /не дочекались/,
    );
    const ourWaiter = waiter(ours);
    await waitForBlockedTree(db, t0, 1);
    expect(await blockedTreeSize(db, await t0.pid)).toBe(1);
    t0.release();
    foreignHolder.release();
    await Promise.all([t0.done, foreignHolder.done, ourWaiter, foreignWaiter]);
  });

  it('дерево зараховує другий рівень: B стоїть на A, що стоїть на тримачі -> розмір 2', async () => {
    const x = `x-${Date.now()}`;
    const z = `z-${Date.now()}`;
    const t0 = holdKey(x);
    await until('T0 тримає замок', t0.acquired);
    // A бере z, потім стає на x (тримач); B стає на z, який тримає A.
    const a = waiter(z, x);
    await waitForBlockedTree(db, t0, 1);
    const b = waiter(z);
    await waitForBlockedTree(db, t0, 2);
    expect(await blockedTreeSize(db, await t0.pid)).toBe(2);
    t0.release();
    await Promise.all([t0.done, a, b]);
  });
});
