import { sql } from 'drizzle-orm';
import type { ActorDb } from './with-actor';

/**
 * Корені товарів під `FOR SHARE`, ЗАВЖДИ в порядку id. Це замок пакетних писарів
 * агрегата (`languages.fill`, звірка проєкції): він конфліктує з `FOR NO KEY UPDATE`
 * команд (`lockProduct`, `lockOnRemove`), тож пакет і команда чекають одне одного
 * лише на корені, а не на дочірніх рядках у протилежних порядках (40P01).
 * Повертає id коренів, що ще існують: зниклі до моменту замка (видалені в чужій
 * транзакції, що вже закомітилась) викликач відкидає. Порядок id — той самий, що
 * бере пакетний `lockOnRemove`, тому два пакетні писарі теж не утворюють цикл.
 */
export async function lockProductRootsShared(
  db: ActorDb,
  ids: readonly string[],
): Promise<string[]> {
  const unique = [...new Set(ids)].sort();
  if (unique.length === 0) return [];
  const res = await db.execute<{ id: string }>(sql`
    select id from public.products
     where id in (${sql.join(
       unique.map((id) => sql`${id}::uuid`),
       sql`, `,
     )})
     order by id
       for share`);
  return res.rows.map((r) => r.id);
}
