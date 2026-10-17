// Гонки двох операцій із засувкою T0 (М1, Task 14): T0 тримає рядковий чи advisory-замок,
// поки перша операція доходить до нього, друга стартує, і лише тоді T0 відпускається —
// вікно між двома замками одного учасника стає керованим, а не мікросекундним.
import { sql } from 'drizzle-orm';
import type { ActorDb } from 'simplycms/db';
import type { AddressingDb } from './addressing-db';
import { hold, sleep, until } from './lock-holders';

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

/** T0 бере `take` (SQL або функцію), далі `first`, пауза, `second`, пауза, відпускання. */
export async function latchRace(
  db: AddressingDb,
  take: string | ((d: ActorDb) => Promise<unknown>),
  first: () => Promise<unknown>,
  second: () => Promise<unknown>,
  gap = 400,
): Promise<[string, string]> {
  const t0 = hold(
    db,
    typeof take === 'string' ? (d) => d.execute(sql.raw(take)) : take,
  );
  await until('T0 тримає засувку', t0.acquired);
  const a = outcome(first());
  await sleep(gap);
  const b = outcome(second());
  await sleep(gap);
  t0.release();
  const out = await Promise.all([a, b]);
  await t0.done;
  return out;
}
