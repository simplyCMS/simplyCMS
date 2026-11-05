import { sql } from 'drizzle-orm';
import type { ActorDb } from 'simplycms/db';
import { PATH_KINDS, raw, type AddressTarget } from './targets';

/**
 * Сутності будь-якого виду з реєстру (`PATH_KINDS`), чия ПОТОЧНА адреса в мові дорівнює
 * `path`. Історичні адреси не рахуються: історія не видаляється, тож блокуй вона — мову з таким
 * кодом не додати ніколи. Шляхи — один сегмент у нижньому регістрі (CHECK
 * `url_paths_path_format`), тож порівнюємо як є. Гілка на вид береться з того самого реєстру,
 * що запис адрес, тож новий вид перевірка не омине.
 */
export async function currentPathOwners(
  db: ActorDb,
  locale: string,
  path: string,
): Promise<{ target: AddressTarget; path: string }[]> {
  const branches = PATH_KINDS.map(
    ({ kind, column }) => sql`
      select ${kind}::text as kind, ${raw(column)}::text as id, path
        from public.url_paths
       where locale = ${locale} and path = ${path} and is_current
         and ${raw(column)} is not null`,
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
