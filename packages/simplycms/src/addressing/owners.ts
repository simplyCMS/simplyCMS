import { sql } from 'drizzle-orm';
import type { ActorDb } from 'simplycms/db';
import type { AddressTarget } from './paths';

/**
 * Сутності, чия ПОТОЧНА адреса в мові дорівнює `path` (вид сутності — з колонки-цілі
 * реєстру; М2 додає гілки разом із `AddressTarget`). Історичні адреси не рахуються: історія
 * не видаляється, тож блокуй вона — мову з таким кодом не додати ніколи. Шляхи — один
 * сегмент у нижньому регістрі (CHECK `url_paths_path_format`), тож порівнюємо як є.
 */
export async function currentPathOwners(
  db: ActorDb,
  locale: string,
  path: string,
): Promise<{ target: AddressTarget; path: string }[]> {
  const res = await db.execute<{ product_id: string; path: string }>(
    sql`select product_id, path from public.url_paths
         where locale = ${locale} and path = ${path} and is_current
           and product_id is not null
         order by product_id`,
  );
  return res.rows.map((r) => ({
    target: { kind: 'product', id: r.product_id },
    path: r.path,
  }));
}
