// Тримачі транзакційних замків для тестів конкуренції (М1, Task 6, 14б): транзакція
// бере замок, сигналізує `acquired` і тримається до `release`. Розводити учасників гонки
// треба спостережуваним станом Postgres (хто став у чергу за замком тримача), а не
// паузою: під навантаженням пауза закінчується раніше, ніж учасник реально заблокувався.
import { sql } from 'drizzle-orm';
import type { ActorDb } from 'simplycms/db';
import type { AddressingDb } from './addressing-db';

export { sleep, until, poll } from './poll';
export * from './blocked-tree';

export interface Holder {
  readonly acquired: () => boolean;
  readonly release: () => void;
  /**
   * pid бекенду транзакції тримача: береться ПЕРШИМ запитом ВСЕРЕДИНІ цієї ж транзакції
   * (до `take`), бо запит до пулу міг би віддати інше з'єднання. Відхиляється, якщо
   * транзакція впала раніше.
   */
  readonly pid: Promise<number>;
  /** Завершення транзакції (коміт) або її помилка. */
  readonly done: Promise<void>;
}

/**
 * Транзакція app_admin: pid, далі `take`, далі утримання до `release`; `after` (якщо є)
 * виконується в ТІЙ САМІЙ транзакції вже після `release` — так пишуться «команди», що
 * беруть замок, чекають і продовжують роботу.
 */
export function hold(
  db: AddressingDb,
  take: (d: ActorDb) => Promise<unknown>,
  after?: (d: ActorDb) => Promise<unknown>,
): Holder {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let acquired = false;
  let setPid!: (pid: number) => void;
  let failPid!: (e: unknown) => void;
  const pid = new Promise<number>((res, rej) => {
    setPid = res;
    failPid = rej;
  });
  pid.catch(() => undefined);
  const done = db.admin(async (d) => {
    const res = await d.execute<{ pid: number }>(
      sql`select pg_backend_pid() as pid`,
    );
    setPid(Number(res.rows[0]!.pid));
    await take(d);
    acquired = true;
    await gate;
    await after?.(d);
  });
  done.catch(failPid);
  return { acquired: () => acquired, release, pid, done };
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
