// Тримачі транзакційних advisory-замків для тестів конкуренції (М1, Task 6):
// транзакція бере замок, сигналізує `acquired` і тримається до `release`.
import type { ActorDb } from 'simplycms/db';
import type { AddressingDb } from './addressing-db';

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Чекає на умову до 5 с; інакше падає — тест не зависає на бажаній події. */
export async function until(
  what: string,
  pred: () => boolean | Promise<boolean>,
): Promise<void> {
  for (let i = 0; i < 100; i += 1) {
    if (await pred()) return;
    await sleep(50);
  }
  throw new Error(`не дочекались: ${what}`);
}

export interface Holder {
  readonly acquired: () => boolean;
  readonly release: () => void;
  /** Завершення транзакції (коміт) або її помилка. */
  readonly done: Promise<void>;
}

/** Транзакція app_admin: `take` виконується першою, далі утримання. */
export function hold(
  db: AddressingDb,
  take: (d: ActorDb) => Promise<unknown>,
): Holder {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let acquired = false;
  const done = db.admin(async (d) => {
    await take(d);
    acquired = true;
    await gate;
  });
  return { acquired: () => acquired, release, done };
}

/** Скільки транзакцій цієї бази зараз ЧЕКАЄ на advisory-замок. */
export async function waiters(db: AddressingDb): Promise<number> {
  const rows = await db.q(
    `select count(*)::int as n from pg_locks l
      where l.locktype = 'advisory' and not l.granted
        and l.database = (select oid from pg_database where datname = current_database())`,
  );
  return Number(rows[0]?.n ?? 0);
}
