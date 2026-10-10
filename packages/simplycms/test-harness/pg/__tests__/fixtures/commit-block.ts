// Обрив саме на COMMIT (Е6д-14): відкладений constraint-тригер падає, коли
// операція вже відпрацювала й обчислила `discard`. Операція, що стирає файли
// ДО COMMIT (або всередині `run`), на цьому кейсі червоніє.

type Exec = (sql: string) => Promise<unknown>;

/**
 * Ставить на `table` відкладений тригер `after <event>`, що кидає на COMMIT.
 * Повертає зняття тригера — кликати у `finally`, інакше він заблокує
 * наступні тести тієї самої БД.
 */
export async function blockCommitOn(
  exec: Exec,
  table: string,
  event: 'update' | 'delete' = 'delete',
): Promise<() => Promise<unknown>> {
  await exec(
    `create or replace function public.e6d_commit_block() returns trigger
       language plpgsql as $$ begin raise exception 'commit blocked'; end $$`,
  );
  await exec(
    `create constraint trigger e6d_commit_block after ${event} on public.${table}
       deferrable initially deferred for each row
       execute function public.e6d_commit_block()`,
  );
  return () => exec(`drop trigger e6d_commit_block on public.${table}`);
}
