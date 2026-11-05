/**
 * Імʼя БД на ОДИН прогін скрипта (live-smoke, pilot-full) і її прибирання.
 *
 * 🔴 Чому не фіксоване імʼя: `scripts/demo-db.mjs` на старті ДРОПАЄ БД із тим
 * самим імʼям (з `pg_terminate_backend` живих зʼєднань). Два прогони на одному
 * кластері стенда з фіксованим імʼям скидали БД один одному просто з-під
 * сервера — звідси «relation does not exist» чи ERR_CONNECTION_REFUSED без
 * жодного дефекту в коді. pid + випадковий суфікс роблять імʼя унікальним, а
 * лише `[a-z0-9_]` і ≤ 63 байти — безпечним ідентифікатором PG без лапок.
 */
import { randomBytes } from 'node:crypto';
import pg from 'pg';

/** Ліміт довжини ідентифікатора PG (NAMEDATALEN - 1). */
const PG_IDENT_MAX = 63;

/** `<prefix>_<pid>_<8 hex>` — унікальне імʼя БД для цього процесу. */
export function uniqueDbName(prefix) {
  const name = `${prefix}_${process.pid}_${randomBytes(4).toString('hex')}`;
  if (!/^[a-z0-9_]+$/.test(name) || Buffer.byteLength(name) > PG_IDENT_MAX)
    throw new Error(`[unique-db-name] недопустиме імʼя БД: ${name}`);
  return name;
}

/**
 * Дропає БД `name` на кластері `adminUrl`; ніколи не кидає (прибирання не має
 * маскувати справжню причину падіння прогону), лише попереджає в stderr.
 */
export async function dropDatabaseQuietly(adminUrl, name) {
  const client = new pg.Client({ connectionString: adminUrl });
  try {
    await client.connect();
    await client.query(
      `select pg_terminate_backend(pid) from pg_stat_activity
         where datname = $1 and pid <> pg_backend_pid()`,
      [name],
    );
    await client.query(`drop database if exists "${name}"`);
  } catch (e) {
    console.error(
      `[unique-db-name] не вдалося прибрати БД ${name}: ${e.message}`,
    );
  } finally {
    await client.end().catch(() => {});
  }
}
