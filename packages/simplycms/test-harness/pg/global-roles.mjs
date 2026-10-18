// vitest `globalSetup` для `test:schema`: ролі кластера (`0000_prelude.sql`) готуються ОДИН раз
// до паралельних накатів. Ролі й членство — об'єкти кластера, а не БД: проєкти `pg`, `storage`,
// `mail` (і чужий прогін на тому самому харнесі) накочують канон на різні БД одночасно, і
// перший запис ролей у спільний каталог з двох сесій давав `tuple concurrently updated`
// (флейк `start-migrate`). Після підготовки прелюдія на кластері нічого не пише в `pg_authid`.
import { join } from 'node:path';
import * as H from './apply.mjs';
import { resolveHarness } from './up.mjs';

export default async function setup() {
  // Ефемерний фолбек-кластер — свій на кожен файл: спільних ролей там немає, готувати нічого.
  if (!process.env.PG_HARNESS_URL) return;
  const harness = await resolveHarness();
  const db = H.randomDbName('simplycms_roles_setup');
  await H.createTempDatabase(harness.url, db);
  try {
    // Прелюдія цілком, а не копія її рольового блоку: канон ролей — один файл.
    await H.applySqlFiles(H.withDbName(harness.url, db), [
      join(H.CANON_DIR, '0000_prelude.sql'),
    ]);
  } finally {
    await H.dropTempDatabase(harness.url, db);
    await harness.teardown();
  }
}
