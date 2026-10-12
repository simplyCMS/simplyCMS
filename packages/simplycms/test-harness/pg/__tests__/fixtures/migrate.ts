// Спільні хелпери гейтів `simplycms/migrate`: свіжа БД і копія канону в
// tmp-теці, куди кейси дописують «нові» файли чи псують наявні.
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listMigrationFiles } from 'simplycms/migrate';
import {
  CANON_DIR,
  createTempDatabase,
  dropTempDatabase,
  queryRows,
  randomDbName,
  withDbName,
} from '../../apply.mjs';

export { CANON_DIR };

/** Імена файлів канону — число й склад виводяться, а не пишуться літералом. */
export const canonNames = (): string[] =>
  listMigrationFiles(CANON_DIR).map((file) => file.name);

/** Тимчасова БД на кластері харнеса; `drop` — для `finally`. */
export async function freshDb(harnessUrl: string) {
  const name = randomDbName('simplycms_migrate');
  await createTempDatabase(harnessUrl, name);
  return {
    url: withDbName(harnessUrl, name),
    drop: () => dropTempDatabase(harnessUrl, name),
  };
}

/** Копія канону в tmp-теці; `write` додає чи переписує файл. */
export function canonCopy() {
  const dir = mkdtempSync(join(tmpdir(), 'simplycms-migrate-'));
  for (const name of canonNames())
    copyFileSync(join(CANON_DIR, name), join(dir, name));
  return {
    dir,
    write: (name: string, sql: string) => writeFileSync(join(dir, name), sql),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

/** Одне число (`… as n`). */
export const numberOf = async (url: string, sql: string): Promise<number> =>
  ((await queryRows(url, sql)) as { n: number }[])[0]!.n;

/** Чи існує відношення (`to_regclass`). */
export const exists = async (url: string, relation: string) =>
  (
    (await queryRows(url, 'select to_regclass($1) is not null as e', [
      relation,
    ])) as { e: boolean }[]
  )[0]!.e;

/** Журнал (ім'я → сума) з-під власника. */
export const journalOf = async (url: string) =>
  (await queryRows(
    url,
    'select name, checksum from public.simplycms_migrations order by name',
  )) as { name: string; checksum: string }[];
