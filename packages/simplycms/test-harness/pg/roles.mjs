// Підготовка ролей кластера для харнеса `test:schema` — ОДНА для обох шляхів `resolveHarness`
// (заданий `PG_HARNESS_URL` і ефемерний фолбек `initdb`): ролі `app_*` і членство — об'єкти
// кластера, і тести, що працюють із ними напряму (`prelude-roles-concurrency`), мусять мати їх
// незалежно від того, який шлях дав кластер. Канон ролей — сама прелюдія (`0000_prelude.sql`),
// накочена на тимчасову БД, а не її копія тут.
import { join } from 'node:path';
import pg from 'pg';
import * as H from './apply.mjs';

const ROLES = ['app_runtime', 'app_user', 'app_admin'];

/** Ключ сесійного advisory-замка підготовки (у БД адмін-з'єднання). */
const LOCK_SQL = "select pg_advisory_lock(hashtext('simplycms-harness-roles'))";

async function rolesReady(client) {
  const res = await client.query(
    'select count(*)::int as n from pg_roles where rolname = any($1)',
    [ROLES],
  );
  return res.rows[0].n === ROLES.length;
}

/**
 * Ролі є — нічого не пишемо (читання `pg_roles`, без запису в каталог). Інакше — під
 * сесійним advisory-замком (паралельні проєкти й файли першими створювали б ті самі ролі:
 * `duplicate key`) ще раз перевіряємо й накочуємо прелюдію на тимчасову БД.
 */
export async function prepareClusterRoles(adminUrl) {
  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();
  try {
    if (await rolesReady(client)) return;
    await client.query(LOCK_SQL);
    if (await rolesReady(client)) return;
    const db = H.randomDbName('simplycms_roles_setup');
    await H.createTempDatabase(adminUrl, db);
    try {
      await H.applySqlFiles(H.withDbName(adminUrl, db), [
        join(H.CANON_DIR, '0000_prelude.sql'),
      ]);
    } finally {
      await H.dropTempDatabase(adminUrl, db);
    }
  } finally {
    // Сесійний замок звільняється разом із з'єднанням.
    await client.end();
  }
}
