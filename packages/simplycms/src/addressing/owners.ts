import { sql } from 'drizzle-orm';
import type { ActorDb } from 'simplycms/db';
import { PATH_TARGET_COLUMNS, type AddressTarget } from './paths';

/**
 * Сутності будь-якого виду з реєстру (`PATH_TARGET_COLUMNS`), чия ПОТОЧНА адреса в мові дорівнює
 * `path`. Історичні адреси не рахуються: історія не видаляється, тож блокуй вона — мову з таким
 * кодом не додати ніколи. Шляхи — один сегмент у нижньому регістрі (CHECK
 * `url_paths_path_format`), тож порівнюємо як є. У М1 вид один — товар; гілка на вид береться
 * з того самого носія, що запис адрес, тож новий вид М2 перевірка не омине.
 */
export async function currentPathOwners(
  db: ActorDb,
  locale: string,
  path: string,
): Promise<{ target: AddressTarget; path: string }[]> {
  const branches = Object.entries(PATH_TARGET_COLUMNS).map(
    ([kind, col]) => sql`
      select ${kind}::text as kind, ${sql.raw(col)}::text as id, path
        from public.url_paths
       where locale = ${locale} and path = ${path} and is_current
         and ${sql.raw(col)} is not null`,
  );
  const res = await db.execute<{
    kind: AddressTarget['kind'];
    id: string;
    path: string;
  }>(
    sql`select * from (${sql.join(branches, sql` union all `)}) o order by kind, id`,
  );
  return res.rows.map((r) => ({
    target: { kind: r.kind, id: r.id },
    path: r.path,
  }));
}
