// Очікування реального блокування замість пауз (М1, Task 14б): дерево очікування від
// тримача замка за `pg_blocking_pids`. Спостережуваний стан Postgres, а не час.
import { queryRows } from '../../apply.mjs';
import type { AddressingDb } from './addressing-db';
import type { Holder } from './lock-holders';
import { poll, type PollOptions } from './poll';

type Q = Pick<AddressingDb, 'q'>;
type Pid = number | Promise<number> | Pick<Holder, 'pid'> | Holder;

const resolvePid = async (p: Pid): Promise<number> =>
  typeof p === 'number' || p instanceof Promise ? p : p.pid;

export interface TreeRow {
  readonly pid: number;
  readonly query: string;
  /** Стоїть безпосередньо на тримачі (а не на іншому очікувачі). */
  readonly direct: boolean;
}

/**
 * Дерево очікування від `holderPid` без кореня: бекенди цієї бази, що стоять на тримачі,
 * і ті, що стоять на них (рекурсивно, через `pg_blocking_pids`, яка враховує й чергу за
 * замком). Чужі заблоковані бекенди поза деревом не зараховуються. `union` без глибини,
 * щоб цикл (тимчасовий deadlock до розв'язання) не зациклив запит. Прямі — першими.
 */
export async function blockedTree(
  db: Q,
  holderPid: number,
): Promise<TreeRow[]> {
  const rows = await db.q(
    `with recursive tree(pid) as (
       select a.pid from pg_stat_activity a
        where a.datname = current_database() and a.pid <> $1::int
          and $1::int = any(pg_blocking_pids(a.pid))
       union
       select a.pid from pg_stat_activity a join tree t on t.pid = any(pg_blocking_pids(a.pid))
        where a.datname = current_database() and a.pid <> $1::int
     )
     select a.pid, a.query, ($1::int = any(pg_blocking_pids(a.pid))) as direct
       from pg_stat_activity a where a.pid in (select pid from tree)
      order by direct desc, a.pid`,
    [holderPid],
  );
  return rows as unknown as TreeRow[];
}

export const blockedTreeSize = async (
  db: Q,
  holderPid: number,
): Promise<number> => (await blockedTree(db, holderPid)).length;

interface TreeWait extends Omit<PollOptions, 'onFail'> {
  /** Якщо не дочекались чи запит упав — відпустити тримача (лише коли `holder` — `Holder`). */
  readonly releaseOnFail?: boolean;
}

async function waitTree(
  db: Q,
  holder: Pid,
  n: number | (() => number),
  opts: TreeWait,
  settled: readonly Promise<unknown>[] = [],
): Promise<void> {
  const holderPid = await resolvePid(holder);
  let done = false;
  for (const p of settled)
    p.then(
      () => (done = true),
      () => (done = true),
    );
  const want = () => (typeof n === 'function' ? n() : n);
  let size = 0;
  await poll(
    () => `у дереві очікування pid ${holderPid} ${size} з ${want()}`,
    async () => {
      size = await blockedTreeSize(db, holderPid);
      return size >= want() || done ? true : undefined;
    },
    {
      ...opts,
      onFail: () => {
        if (
          opts.releaseOnFail &&
          typeof holder === 'object' &&
          'release' in holder
        )
          holder.release();
      },
    },
  );
}

/**
 * СТРОГИЙ: чекає, поки дерево очікування від тримача виросте до `n`; інакше після
 * дедлайну падає «не дочекались». Для кейсів, де блокування — сама суть (40P01,
 * FOR UPDATE <-> KEY SHARE, унікальний індекс).
 */
export const waitForBlockedTree = (
  db: Q,
  holder: Pid,
  n: number | (() => number),
  opts: TreeWait = {},
): Promise<void> => waitTree(db, holder, n, opts);

/**
 * НЕСТРОГИЙ: те саме, але закінчується і тоді, коли завершився будь-який із `settled`
 * (учасник міг узагалі не блокуватись).
 */
export const waitForBlockedTreeOrSettled = (
  db: Q,
  holder: Pid,
  n: number | (() => number),
  settled: readonly Promise<unknown>[],
  opts: TreeWait = {},
): Promise<void> => waitTree(db, holder, n, opts, settled);

/**
 * «Учасник мусить ЗАВЕРШИТИСЬ, поки тримач ще тримає замок» (учасник не стає в чергу):
 * доводить передумову кейсів «команда комітить повз застряглий fill». Інакше — «не дочекались».
 */
export async function waitForSettled(
  what: string,
  p: Promise<unknown>,
  holder?: Holder,
  opts: Omit<PollOptions, 'onFail'> = {},
): Promise<void> {
  let done = false;
  p.then(
    () => (done = true),
    () => (done = true),
  );
  await poll(what, () => (done ? true : undefined), {
    ...opts,
    onFail: () => holder?.release(),
  });
}

/**
 * Дочікується бекенда, що стоїть на `holderPid` (N=1 дерева), і віддає його pid та запит;
 * приймає DSN, бо його кличуть тести без `AddressingDb`.
 */
export const waitForBlockedBy = async (
  dbUrl: string,
  holderPid: number,
  deadlineMs = 5_000,
  stepMs = 25,
): Promise<{ pid: number; query: string }> => {
  const q: Q['q'] = (sql, params) =>
    queryRows(dbUrl, sql, params) as Promise<Record<string, unknown>[]>;
  const row = await poll(
    `ніхто не став на лок ${holderPid}`,
    async () => (await blockedTree({ q }, holderPid))[0],
    { deadlineMs, stepMs },
  );
  return { pid: row.pid, query: row.query };
};
