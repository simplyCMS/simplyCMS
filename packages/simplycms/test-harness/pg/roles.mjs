// Підготовка ролей кластера для харнеса `test:schema` — ОДНА для обох шляхів `resolveHarness`
// (заданий `PG_HARNESS_URL` і ефемерний фолбек `initdb`): ролі `app_*` і членство — об'єкти
// кластера, і тести, що працюють із ними напряму (`prelude-roles-concurrency`), мусять мати їх
// незалежно від того, який шлях дав кластер. Канон ролей — сама прелюдія (`0000_prelude.sql`),
// накочена на тимчасову БД, а не її копія тут.
import { join } from 'node:path';
import * as H from './apply.mjs';
import { ROLES_LOCK, withClusterLock } from './cluster-lock.mjs';

const ROLES = ['app_runtime', 'app_user', 'app_admin'];

async function rolesReady(adminUrl) {
  const rows = await H.queryRows(
    adminUrl,
    'select count(*)::int as n from pg_roles where rolname = any($1)',
    [ROLES],
  );
  return rows[0].n === ROLES.length;
}

/**
 * Ролі є — нічого не пишемо (читання `pg_roles`, без запису в каталог). Інакше — під замком
 * КЛАСТЕРА (`cluster-lock.mjs`: паралельні проєкти, файли й прогони, навіть через різні БД
 * того самого кластера, першими створювали б ті самі ролі — `duplicate key`) ще раз
 * перевіряємо й накочуємо прелюдію на тимчасову БД.
 */
export async function prepareClusterRoles(adminUrl) {
  if (await rolesReady(adminUrl)) return;
  await withClusterLock(adminUrl, ROLES_LOCK, async () => {
    if (await rolesReady(adminUrl)) return;
    const db = H.randomDbName('simplycms_roles_setup');
    await H.createTempDatabase(adminUrl, db);
    try {
      await H.applySqlFiles(H.withDbName(adminUrl, db), [
        join(H.CANON_DIR, '0000_prelude.sql'),
      ]);
    } finally {
      await H.dropTempDatabase(adminUrl, db);
    }
  });
}
