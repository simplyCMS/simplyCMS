import type pg from 'pg';
import type { Actor, ActorDb } from 'simplycms/db';

/**
 * Ескалація ролі покупця в `app_admin` — механіка `operator(fn)`, яку
 * `db.ts` віддає з `withCustomerDb`/`withOrderTokenDb`. Винесено в окремий
 * модуль лише заради канону 150 рядків на файл: `db.ts` уже несе чотири
 * публічні обгортки транзакцій, і сюди переїхала саме РЕАЛІЗАЦІЯ ескалації,
 * а не її контракт використання (той лишається в докблоках `db.ts`).
 *
 * 🔴 `operator` — звичайне замикання над `pg.PoolClient` (рев'ю M1): якщо
 * його ЗБЕРЕГТИ й викликати вже ПІСЛЯ того, як транзакція, для якої його
 * створено, завершилась (закоммічена чи відкочена, зʼєднання повернуте в
 * пул `client.release()`), `set local role` пішов би на зʼєднання, яке пул
 * тим часом міг віддати ЗОВСІМ ІНШОМУ запиту — тихий захват чужого
 * зʼєднання чужою роллю. Тому кожен виклик обгортки в `db.ts` заводить
 * власний `EscalationState` і позначає `finished = true` лише ПІСЛЯ того,
 * як уся транзакція (разом із COMMIT/ROLLBACK і поверненням зʼєднання)
 * завершилась (`.finally()` на промісі `withActor`); виклик `operator` після
 * цього кидає гучну помилку замість тихої роботи з чужим зʼєднанням.
 */
export type OperatorEscalation = <T>(
  fn: (db: ActorDb) => Promise<T>,
) => Promise<T>;

/** Чи вже завершилась транзакція, для якої створено `operator`. */
export interface EscalationState {
  finished: boolean;
}

/**
 * Фабрика `operator(fn)` для однієї транзакції: `SET LOCAL ROLE app_admin`
 * рівно на час `fn`, з негайним і гарантованим поверненням до ролі актора.
 *
 * Правило використання — в докблоках `withCustomerDb`/`withOrderTokenDb`
 * (`db.ts`) і в `data-access.instructions.md`, «Ескалація ролі покупцем»:
 * викликати ПІСЛЯ того, як RLS уже прийняла читання чи запис покупця в цій
 * транзакції, і лише для обліку магазину.
 */
export function escalationFor(
  client: pg.PoolClient,
  db: ActorDb,
  actor: Actor,
  state: EscalationState,
): OperatorEscalation {
  return async (fn) => {
    if (state.finished) {
      // 🔴 Захоплений `operator`, викликаний уже поза своєю транзакцією, —
      // зʼєднання давно в пулі й могло дістатись іншому запиту. Гучний кидок
      // тут — і є та гарантія, яку раніше лише декларував докблок (M1).
      throw new Error(
        '[simplycms] OperatorEscalation called after its transaction already finished — do not capture `operator` for use outside the callback it was given to.',
      );
    }
    await client.query('set local role app_admin');
    try {
      return await fn(db);
    } finally {
      await restoreRoleQuietly(client, actor);
    }
  };
}

/**
 * Повернення ролі актора, яке не підміняє собою первинну помилку.
 *
 * 🔴 Саме `finally`, а не success-path: `InsufficientStockError` кидається
 * чистим JS ПІСЛЯ успішного `SELECT … FOR UPDATE`, тобто транзакція в цей
 * момент ЖИВА — без повернення ролі решта транзакції лишилася б під
 * `app_admin`, і ескалація пережила б `fn`, хоч контракт обіцяє «рівно на
 * час `fn`».
 *
 * 🔴 І саме ТИХО — точно як `rollbackQuietly` (`db/with-actor.ts:81-87`):
 * якщо `fn` упав ЗАПИТОМ, транзакція вже aborted, і `set local role` кинув
 * би 25P02, замаскувавши першопричину. Гасити помилку тут безпечно: таку
 * транзакцію `withActor` однаково відкотить, а ROLLBACK сам скидає
 * `SET LOCAL ROLE`. Імʼя ролі — з валідованого `Actor`.
 */
async function restoreRoleQuietly(
  client: pg.PoolClient,
  actor: Actor,
): Promise<void> {
  try {
    await client.query(`set local role ${actor.role}`);
  } catch {
    // Свідомо тихо — див. докблок вище.
  }
}
