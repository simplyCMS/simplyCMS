// Гонки двох операцій із засувкою T0 (М1, Task 14): T0 тримає рядковий чи advisory-замок,
// поки перша операція доходить до нього, друга стартує, і лише тоді T0 відпускається —
// вікно між двома замками одного учасника стає керованим, а не мікросекундним.
import { sql } from 'drizzle-orm';
import type { ActorDb } from 'simplycms/db';
import type { AddressingDb } from './addressing-db';
import {
  hold,
  until,
  waitForBlockedTree,
  waitForBlockedTreeOrSettled,
} from './lock-holders';

/** Результат операції одним рядком: `ok`, код PG, `kind:constraint` конфлікту чи ім'я помилки. */
export const outcome = (p: Promise<unknown>): Promise<string> =>
  p.then(
    () => 'ok',
    (e: unknown) => {
      const err = e as {
        cause?: { code?: string };
        kind?: string;
        constraint?: string | null;
        name?: string;
      };
      if (err.cause?.code) return err.cause.code;
      if (err.kind) return `${err.kind}:${err.constraint ?? ''}`;
      return err.name ?? String(e);
    },
  );

/**
 * Режим очікування учасника: `strict` — він МУСИТЬ стати в чергу за замком (інакше
 * «не дочекались»); `loose` — може й не блокуватись (пропустив рядок і завершився ok).
 */
export type WaitMode = 'strict' | 'loose';

/**
 * T0 бере `take` (SQL або функцію), далі `first`; коли `first` став у чергу за T0, — `second`;
 * коли й він у дереві очікування T0 (на T0 або на `first`), T0 відпускається. Розведення —
 * за станом Postgres, не за паузою. За замовчуванням обидва учасники строгі.
 */
export async function latchRace(
  db: AddressingDb,
  take: string | ((d: ActorDb) => Promise<unknown>),
  first: () => Promise<unknown>,
  second: () => Promise<unknown>,
  modes: { first?: WaitMode; second?: WaitMode } = {},
): Promise<[string, string]> {
  const t0 = hold(
    db,
    typeof take === 'string' ? (d) => d.execute(sql.raw(take)) : take,
  );
  await until('T0 тримає засувку', t0.acquired);
  const running: Promise<unknown>[] = [];
  try {
    const a = outcome(first());
    running.push(a);
    let aDone = false;
    void a.then(() => (aDone = true));
    if (modes.first === 'loose')
      await waitForBlockedTreeOrSettled(db, t0, 1, [a]);
    else await waitForBlockedTree(db, t0, 1);
    const b = outcome(second());
    running.push(b);
    // Якщо `first` уже завершився, другому нема на кому стояти, крім T0: рівень 1.
    const need = () => (aDone ? 1 : 2);
    if (modes.second === 'loose')
      await waitForBlockedTreeOrSettled(db, t0, need, [b]);
    else await waitForBlockedTree(db, t0, need);
  } catch (e) {
    // Не лишаємо T0 висіти з відкритою транзакцією: наступні тести бачили б його замок.
    t0.release();
    await Promise.allSettled([...running, t0.done]);
    throw e;
  }
  const [a, b] = running as [Promise<string>, Promise<string>];
  t0.release();
  const out = await Promise.all([a, b]);
  await t0.done;
  return out;
}
