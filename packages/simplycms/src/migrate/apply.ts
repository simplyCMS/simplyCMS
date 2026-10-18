import pg from 'pg';
import { MIGRATION_LOCK_KEY } from 'simplycms/db/lock-keys';
import {
  MigrationChecksumError,
  SUPERUSER_HINT,
  UnjournaledDatabaseError,
} from './errors';
import {
  checksumOf,
  listMigrationFiles,
  readMigrationSql,
  type MigrationFile,
} from './files';
import {
  CREATE_JOURNAL_SQL,
  GRANT_JOURNAL_SQL,
  missingFromDir,
  pendingMigrations,
  selectJournal,
  type JournalRow,
} from './journal';
import {
  parseRuntimeCredentials,
  syncRuntimePassword,
} from './runtime-password';

// Ключ сесійного `pg_advisory_lock` накату живе в реєстрі ключів замків
// (`simplycms/db/lock-keys`): один простір ключів на базу, і лише реєстр доводить,
// що жоден рядковий ключ не збігається з ним.
const LOCK_PARAMS = [MIGRATION_LOCK_KEY.toString()];

export type ApplyOptions = {
  connectionString: string;
  dir: string;
  runtimeUrl?: string;
  dryRun?: boolean;
  log?: (line: string) => void;
};

export type ApplyReport = {
  applied: string[];
  pending: string[];
  runtimePasswordSynced: boolean;
};

/**
 * Єдина реалізація накату (Е8-Р2): старт контейнера, `db:apply`, харнес
 * `test:schema` і `db:demo`. Порядок кроків — контракт, а не стиль:
 * лок → перевірка бази без журналу → звірка сум (усе ДО першого DDL) →
 * `dryRun` повертається, нічого не створивши → журнал → файли, кожен в
 * одній транзакції зі своїм записом → грант журналу (роль `app_admin`
 * з'являється лише з `0000_prelude.sql`; і після падіння файлу теж) →
 * пароль `app_runtime`. `runtimeUrl` розбирається ще ДО з'єднання: поганий
 * пароль зупиняє старт, не зачепивши базу.
 */
export async function applyMigrations(o: ApplyOptions): Promise<ApplyReport> {
  const log = o.log ?? (() => {});
  const files = listMigrationFiles(o.dir);
  const credentials = o.runtimeUrl
    ? parseRuntimeCredentials(o.runtimeUrl)
    : null;
  const client = new pg.Client({ connectionString: o.connectionString });
  await client.connect();
  let locked = false;
  try {
    await client.query('select pg_advisory_lock($1::bigint)', LOCK_PARAMS);
    locked = true;
    const rows = await journalOrRefuse(client);
    const { pending, changed } = pendingMigrations(rows, files);
    if (changed.length > 0) throw new MigrationChecksumError(changed);
    // Не помилка (вміст файлу в базі вже є), але власник має знати: зазвичай
    // це видалений плагін чи підмінена тека міграцій.
    for (const name of missingFromDir(rows, files))
      log(`[migrate] файл ${name} є в журналі, але відсутній у теці`);
    if (o.dryRun) {
      log(`[migrate] dry-run: до накату ${pending.length}`);
      return { applied: [], pending, runtimePasswordSynced: false };
    }
    await client.query(CREATE_JOURNAL_SQL);
    const byName = new Map(files.map((file) => [file.name, file]));
    const applied: string[] = [];
    try {
      for (const name of pending) {
        await applyOne(client, byName.get(name)!);
        applied.push(name);
        log(`[migrate] накочено ${name}`);
      }
    } catch (err) {
      // Уже накочені рядки мусять лишитись читабельними для `app_admin`;
      // помилка гранту не підміняє причину падіння файлу.
      await client.query(GRANT_JOURNAL_SQL).catch(() => {});
      throw err;
    }
    await client.query(GRANT_JOURNAL_SQL);
    const runtimePasswordSynced = credentials
      ? await syncRuntimePassword(client, credentials, log)
      : false;
    log(`[migrate] готово: накочено ${applied.length}, усього ${files.length}`);
    return { applied, pending: [], runtimePasswordSynced };
  } finally {
    if (locked) {
      // Зламане з'єднання лок і так відпускає; помилка unlock не має
      // підмінити справжню причину виходу з `try`.
      await client
        .query('select pg_advisory_unlock($1::bigint)', LOCK_PARAMS)
        .catch(() => {});
    }
    await client.end();
  }
}

/**
 * Рядки журналу; журналу немає — `[]` для чистої бази, але відмова, якщо в
 * базі вже є схема магазину (`public.products`).
 */
async function journalOrRefuse(client: pg.ClientBase): Promise<JournalRow[]> {
  const { rows } = await client.query<{ journal: boolean; store: boolean }>(
    `select to_regclass('public.simplycms_migrations') is not null as journal,
            to_regclass('public.products') is not null as store`,
  );
  if (rows[0]!.journal) return selectJournal(client);
  if (rows[0]!.store) throw new UnjournaledDatabaseError();
  return [];
}

/**
 * Файл і його запис у журналі — одна транзакція: файл, що впав, відкочується
 * цілком і в журнал не потрапляє, тож повторний старт після виправлення його
 * накотить. Вміст перечитується й звіряється із сумою зі списку, щоб у
 * журнал не лягла сума іншого вмісту, ніж накочений.
 */
async function applyOne(
  client: pg.ClientBase,
  file: MigrationFile,
): Promise<void> {
  const sql = readMigrationSql(file.path);
  if (checksumOf(sql) !== file.checksum)
    throw new MigrationChecksumError([file.name]);
  await client.query('begin');
  try {
    await client.query(sql);
    await client.query(
      'insert into public.simplycms_migrations (name, checksum) values ($1, $2)',
      [file.name, file.checksum],
    );
    await client.query('commit');
  } catch (err) {
    await client.query('rollback').catch(() => {});
    // 42501 — брак права: найчастіше роль накату не суперкористувач (прелюдія задає атрибути
    // ролей `app_*`, а їх Postgres дозволяє міняти лише суперкористувачу) — кажемо це прямо.
    const hint =
      (err as { code?: string }).code === '42501' ? SUPERUSER_HINT : '';
    throw new Error(
      `[simplycms/migrate] Накат ${file.name} впав: ${(err as Error).message}${hint}`,
      { cause: err },
    );
  }
}
