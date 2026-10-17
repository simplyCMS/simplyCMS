// Тримачі транзакційних замків для тестів конкуренції (М1, Task 6, 14б): транзакція
// бере замок, сигналізує `acquired` і тримається до `release`. Розводити учасників гонки
// треба спостережуваним станом Postgres (хто став у чергу за замком тримача), а не
// паузою: під навантаженням пауза закінчується раніше, ніж учасник реально заблокувався.
import { sql } from 'drizzle-orm';
import type { ActorDb } from 'simplycms/db';
import { queryRows } from '../../apply.mjs';
import type { AddressingDb } from './addressing-db';

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Дедлайн і крок опитування: спільні для `until` і всіх очікувачів блокування. */
const DEADLINE_MS = 5_000;
const STEP_MS = 50;

/** Чекає на умову до 5 с; інакше падає — тест не зависає на бажаній події. */
export async function until(
  what: string,
  pred: () => boolean | Promise<boolean>,
): Promise<void> {
  for (let i = 0; i < DEADLINE_MS / STEP_MS; i += 1) {
    if (await pred()) return;
    await sleep(STEP_MS);
  }
  throw new Error(`не дочекались: ${what}`);
}

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

type Q = Pick<AddressingDb, 'q'>;
type Pid = number | Promise<number> | Pick<Holder, 'pid'> | Holder;

const resolvePid = async (p: Pid): Promise<number> =>
  typeof p === 'number' || p instanceof Promise ? p : p.pid;

/**
 * Розмір дерева очікування від `holderPid` без кореня: бекенди цієї бази, що стоять на
 * тримачі, і ті, що стоять на них (рекурсивно, через `pg_blocking_pids`, яка враховує й
 * чергу за замком). Чужі заблоковані бекенди поза деревом не зараховуються. `union` без
 * глибини, щоб цикл (тимчасовий deadlock до розв'язання) не зациклив запит.
 */
export async function blockedTreeSize(
  db: Q,
  holderPid: number,
): Promise<number> {
  const rows = await db.q(
    `with recursive tree(pid) as (
       select a.pid from pg_stat_activity a
        where a.datname = current_database() and a.pid <> $1::int
          and $1::int = any(pg_blocking_pids(a.pid))
       union
       select a.pid from pg_stat_activity a join tree t on t.pid = any(pg_blocking_pids(a.pid))
        where a.datname = current_database() and a.pid <> $1::int
     )
     select count(*)::int as n from tree`,
    [holderPid],
  );
  return Number(rows[0]?.n ?? 0);
}

interface TreeWait {
  /** Нестрогий режим: чекання закінчується і коли будь-який із цих промісів завершився. */
  readonly orSettled?: readonly Promise<unknown>[];
  readonly deadlineMs?: number;
  readonly stepMs?: number;
  /** Якщо не дочекались — відпустити тримача (лише коли `holder` — `Holder`). */
  readonly releaseOnFail?: boolean;
}

async function pollTree(
  db: Q,
  holder: Pid,
  n: number | (() => number),
  opts: TreeWait,
): Promise<void> {
  const { orSettled, deadlineMs = DEADLINE_MS, stepMs = STEP_MS } = opts;
  const holderPid = await resolvePid(holder);
  // `releaseOnFail`: тримач без учасника марний; відпускаємо, щоб його відкрита транзакція
  // не висіла й не ламала наступні тести. Негативні контролі цього НЕ просять.
  const releaseOnFail = () => {
    if (opts.releaseOnFail && typeof holder === 'object' && 'release' in holder)
      holder.release();
  };
  let settled = false;
  for (const p of orSettled ?? []) {
    p.then(
      () => (settled = true),
      () => (settled = true),
    );
  }
  const end = Date.now() + deadlineMs;
  let size = 0;
  while (Date.now() < end) {
    size = await blockedTreeSize(db, holderPid);
    if (size >= (typeof n === 'function' ? n() : n) || settled) return;
    await sleep(stepMs);
  }
  releaseOnFail();
  throw new Error(
    `не дочекались: у дереві очікування pid ${holderPid} ${size} з ${
      typeof n === 'function' ? n() : n
    }`,
  );
}

/**
 * СТРОГИЙ: чекає, поки дерево очікування від тримача виросте до `n`; інакше після
 * дедлайну падає «не дочекались». Для кейсів, де блокування — сама суть (40P01,
 * FOR UPDATE <-> KEY SHARE, унікальний індекс): учасник, що не став у чергу, означає,
 * що тест перевіряє не ту гонку.
 */
export const waitForBlockedTree = (
  db: Q,
  holder: Pid,
  n: number | (() => number),
  opts: Omit<TreeWait, 'orSettled'> = {},
): Promise<void> => pollTree(db, holder, n, opts);

/**
 * НЕСТРОГИЙ: те саме, але закінчується і тоді, коли завершився будь-який із `settled`
 * (учасник, що міг узагалі не блокуватись, — наприклад, пропустив рядок і завершився ok).
 */
export const waitForBlockedTreeOrSettled = (
  db: Q,
  holder: Pid,
  n: number | (() => number),
  settled: readonly Promise<unknown>[],
  opts: Omit<TreeWait, 'orSettled'> = {},
): Promise<void> => pollTree(db, holder, n, { ...opts, orSettled: settled });

/**
 * Опитує `pg_stat_activity` до дедлайну, поки не зʼявиться бекенд, який
 * блокує САМЕ `holderPid` (привʼязка через `pg_blocking_pids`, а не «будь-хто,
 * хто чекає»). Повертає pid і текст запиту, на якому він стоїть. Окремий
 * випадок дерева з N=1, але з DSN замість `AddressingDb` і з виведенням очікувача.
 */
export const waitForBlockedBy = async (
  dbUrl: string,
  holderPid: number,
  deadlineMs = DEADLINE_MS,
  stepMs = 25,
): Promise<{ pid: number; query: string }> => {
  const end = Date.now() + deadlineMs;
  while (Date.now() < end) {
    const rows = (await queryRows(
      dbUrl,
      `select pid, query from pg_stat_activity
        where datname = current_database() and $1 = any(pg_blocking_pids(pid))`,
      [holderPid],
    )) as { pid: number; query: string }[];
    if (rows.length > 0) return rows[0]!;
    await sleep(stepMs);
  }
  throw new Error(
    `[harness] за ${deadlineMs} мс ніхто не став на лок ${holderPid}`,
  );
};
