import pg from 'pg';
import type { MigrationFile } from './files';

/** Рядок журналу накату. */
export type JournalRow = { name: string; checksum: string; appliedAt: Date };

/**
 * Журнал живе в `public`, а не в окремій схемі: baseline свідомо не створює
 * схем, крім `public` і `app`, а `app` — простір функцій RLS. Таблицю
 * створює накат, а не канон: журнал має існувати до першого файлу.
 */
export const CREATE_JOURNAL_SQL = `create table if not exists public.simplycms_migrations (
  name text primary key,
  checksum text not null,
  applied_at timestamptz not null default now()
)`;

/**
 * Читання — `app_admin`, і лише читання: `doctor --online` і `status`
 * ходять із `DATABASE_URL` (`app_runtime`) через `SET ROLE app_admin`, а
 * писати журнал має право лише власник схеми під час накату. Ідемпотентно:
 * виконується після кожного накату, бо роль створює `0000_prelude.sql`.
 */
export const GRANT_JOURNAL_SQL =
  'grant select on public.simplycms_migrations to app_admin';

const SELECT_JOURNAL_SQL = `select name, checksum, applied_at
  from public.simplycms_migrations order by name`;

type RawRow = { name: string; checksum: string; applied_at: Date };

const toRow = (raw: RawRow): JournalRow => ({
  name: raw.name,
  checksum: raw.checksum,
  appliedAt: raw.applied_at,
});

/** Журнал тим самим з'єднанням (накат під власником). */
export async function selectJournal(
  client: pg.ClientBase,
): Promise<JournalRow[]> {
  const { rows } = await client.query<RawRow>(SELECT_JOURNAL_SQL);
  return rows.map(toRow);
}

/**
 * Журнал із рантайм-підключення (`DATABASE_URL`, роль `app_runtime`).
 * `app_runtime` прямих прав не має (fail-closed), тож читання — у read-only
 * транзакції під `SET LOCAL ROLE app_admin` (членство дає `0000_prelude`).
 *
 * @returns `null`, якщо журналу в базі немає.
 */
export async function readJournal(
  runtimeConnectionString: string,
): Promise<JournalRow[] | null> {
  const client = new pg.Client({ connectionString: runtimeConnectionString });
  await client.connect();
  try {
    await client.query('begin read only');
    try {
      await client.query('set local role app_admin');
      const rows = await selectJournal(client);
      await client.query('commit');
      return rows;
    } catch (err) {
      await client.query('rollback');
      if ((err as { code?: string }).code === '42P01') return null;
      throw err;
    }
  } finally {
    await client.end();
  }
}

/**
 * Що накотити і що змінилось. `pending` — файли без запису в журналі в
 * порядку імен (ім'я, що сортується перед уже накоченим, теж сюди:
 * плагінні timestamp-файли й нові файли ядра перемежовуються). `changed` —
 * накочені файли, чия сума розійшлась із журналом.
 */
export function pendingMigrations(
  rows: JournalRow[],
  files: MigrationFile[],
): { pending: string[]; changed: string[] } {
  const applied = new Map(rows.map((row) => [row.name, row.checksum]));
  const pending: string[] = [];
  const changed: string[] = [];
  for (const file of files) {
    const checksum = applied.get(file.name);
    if (checksum === undefined) pending.push(file.name);
    else if (checksum !== file.checksum) changed.push(file.name);
  }
  return { pending, changed };
}
