import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import type pg from 'pg';
import { buildActorPrelude, type Actor } from './actor';
import { getDbPool } from './client';

/**
 * Транзакційна обгортка актора — ЄДИНИЙ канал до Postgres (Task 6, В2-К1а).
 *
 * Форма транзакції зафіксована контрактом B5″ і повторює ту, яку незалежно
 * міряє поведінковий гейт RLS (`test-harness/pg/actors.mjs`):
 *
 *   BEGIN;
 *   select set_config('app.user_id', <uuid|''>, true);
 *   select set_config('app.order_token', <token|''>, true);
 *   SET LOCAL ROLE app_user|app_admin;
 *   …робота…
 *   COMMIT;                      -- або ROLLBACK на будь-якому винятку
 *
 * 🔴 `SET LOCAL ROLE` — обовʼязковий, а не опційний. Застосунок логіниться як
 * `app_runtime`, у якої прямих грантів немає: без перемикання ролі будь-який
 * запит дає `permission denied`. Це не дефект обгортки, а весь сенс
 * fail-closed — забутий крок мусить бути гучним, а не тихо працювати з
 * правами власника таблиць.
 */

/** Drizzle-інстанс, прибіндований до зʼєднання ЦІЄЇ транзакції. */
export type ActorDb = NodePgDatabase<Record<string, never>>;

/**
 * Виконує `fn` в одній транзакції від імені `actor`.
 *
 * `fn` отримує drizzle над зʼєднанням саме цієї транзакції — не над пулом:
 * інстанс над пулом брав би для кожного запиту ДОВІЛЬНЕ зʼєднання, тобто
 * поза транзакцією, без claims і без ролі. Тому «взяти db глобально» тут
 * неможливо за побудовою.
 *
 * Значення, повернуте `fn`, віддається назовні після COMMIT. Будь-який
 * виняток (у т.ч. `permission denied` чи порушення WITH CHECK) відкочує
 * транзакцію й прокидується далі — саме на ньому й тримається контракт.
 */
export async function withActor<T>(
  actor: Actor,
  fn: (db: ActorDb, client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  // Преамбула будується ДО `connect()`: невалідна роль чи userId не мають
  // навіть займати зʼєднання пулу.
  const prelude = buildActorPrelude(actor);
  const client = await getDbPool().connect();

  try {
    await client.query('begin');
    try {
      for (const statement of prelude)
        await client.query(statement.text, [...statement.values]);

      const result = await fn(drizzle(client), client);
      await client.query('commit');
      return result;
    } catch (error) {
      await rollbackQuietly(client);
      throw error;
    }
  } finally {
    // 🔴 Повернення зʼєднання в пул — у `finally` і без умов. Витік тут не
    // падає, а мовчки виїдає пул до повного зависання застосунку на
    // `connect()`, тобто дає найгірший клас дефекту: симптом далеко від
    // причини. Інтеграційний гейт доводить факт повернення тим, що наступна
    // транзакція йде тим САМИМ backend pid.
    client.release();
  }
}

/**
 * ROLLBACK, який не підміняє собою первинну помилку.
 *
 * Якщо зʼєднання вже мертве (обрив, таймаут), сам `rollback` теж кине — і
 * назовні поїхала б помилка відкату замість справжньої причини. Тут вона
 * гаситься: транзакція мертвого зʼєднання й так не закоммітиться, а причину
 * викликач має побачити ту, що сталася першою.
 */
async function rollbackQuietly(client: pg.PoolClient): Promise<void> {
  try {
    await client.query('rollback');
  } catch {
    // Свідомо тихо — див. докблок вище.
  }
}
