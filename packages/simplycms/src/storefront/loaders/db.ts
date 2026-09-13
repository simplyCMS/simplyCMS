import { withActor, type Actor, type ActorDb } from 'simplycms/db';
import type pg from 'pg';

export type { ActorDb };

/**
 * Транзакція вітрини — вхід у БД для ПУБЛІЧНОГО читання (В2-К1а).
 *
 * 🔴 Роль завжди `app_user` і завжди БЕЗ `userId`. Каталог однаковий для всіх,
 * тож ідентичність тут не потрібна, а `app_admin` для публічного читання зняв
 * би єдиний рубіж, який ще розрізняє покупця й адмінку. Персональні дані
 * читаються `withCustomerDb` — і тільки з id, узятим із серверної сесії.
 *
 * 🔴 Обгортка приймає ФУНКЦІЮ, а не віддає `db` назовні: усі запити однієї
 * сторінки мають лягти в ОДНУ транзакцію. Інакше кожен лоадер брав би власне
 * зʼєднання пулу — і сторінка збиралася б із кількох різних знімків БД.
 */
export function withStorefrontDb<T>(
  fn: (db: ActorDb) => Promise<T>,
): Promise<T> {
  return withActor({ role: 'app_user' }, (db) => fn(db));
}

/**
 * Службова дія магазину ВСЕРЕДИНІ транзакції покупця — під `app_admin`,
 * з негайним поверненням до ролі актора.
 *
 * 🔴 Навіщо, коли є `withStoreOperatorDb`: списання залишку мусить бути в
 * ТІЙ САМІЙ транзакції, що й вставка замовлення (інакше замовлення без
 * списання або списання без замовлення), а скасування з поверненням залишку
 * — у тій самій, що й перевірка права (інакше між «перевірив» і «записав» —
 * вікно). `app_user` за `0002_grants.sql` має на
 * `products` (`:78`) і `stock_by_pickup_point` (`:87`) лише SELECT і не має
 * UPDATE на `orders` (`:104`) — і це правильно: покупець не пише в облік і не редагує
 * замовлення. Тому роль перемикається рівно на час службової дії тим самим
 * `SET LOCAL ROLE`, яким її ставить `withActor`; runtime-роль має `set true`
 * на обидві (`0000_prelude.sql:94-95`), а членство Postgres перевіряє проти
 * session user, не проти поточної ролі.
 *
 * Правило використання — те саме, що в `withStoreOperatorDb`, лише всередині
 * однієї транзакції: викликати ПІСЛЯ того, як RLS уже прийняла читання чи
 * запис покупця в цій транзакції, і лише для обліку магазину — ніколи для
 * читання чи запису чужих рядків. Функція недоступна поза обгортками нижче:
 * її створює сама транзакція, тож «ескалація з нізвідки» неможлива за
 * побудовою. Канон — `data-access.instructions.md`, «Ескалація ролі покупцем».
 */
export type OperatorEscalation = <T>(
  fn: (db: ActorDb) => Promise<T>,
) => Promise<T>;

function escalationFor(
  client: pg.PoolClient,
  db: ActorDb,
  actor: Actor,
): OperatorEscalation {
  return async (fn) => {
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

/**
 * Транзакція ЗАЛОГІНЕНОГО покупця: `app_user` + GUC `app.user_id`.
 *
 * 🔴 `userId` сюди приходить ЛИШЕ з `readSessionSubject` серверної сесії й
 * ніколи з параметра клієнта. Актора задає сервер, тож підставлений у запит
 * чужий id RLS не спинить — вона звірятиме рядки саме з тим, кого їй назвали.
 * Це і є та межа, яку не можна перекласти на базу.
 */
export function withCustomerDb<T>(
  userId: string,
  fn: (db: ActorDb, operator: OperatorEscalation) => Promise<T>,
): Promise<T> {
  const actor: Actor = { role: 'app_user', userId };
  return withActor(actor, (db, client) =>
    fn(db, escalationFor(client, db, actor)),
  );
}

/**
 * Транзакція ГОСТЬОВОГО замовлення: `app_user` + GUC `app.order_token`.
 *
 * Гість не має ідентичності — його доступ до одного замовлення доводить
 * одноразовий токен із посилання (`orders_select_own_or_token`).
 */
export function withOrderTokenDb<T>(
  orderToken: string,
  fn: (db: ActorDb, operator: OperatorEscalation) => Promise<T>,
): Promise<T> {
  const actor: Actor = { role: 'app_user', orderToken };
  return withActor(actor, (db, client) =>
    fn(db, escalationFor(client, db, actor)),
  );
}

/**
 * Транзакція службової мутації магазину — `app_admin`.
 *
 * 🔴 Потрібна там, де покупець ініціює зміну, якої НЕ сміє робити сам:
 * `0002_grants.sql` навмисно не дає `app_user` UPDATE на `orders`, тож
 * скасування замовлення — серверна операція. Правило використання жорстке:
 * спершу довести право під `withCustomerDb` (RLS віддасть рядок лише
 * власнику), і лише потім писати звідси. Виклик без такої перевірки —
 * підвищення прав, а не оптимізація.
 *
 * 🔴 Для дій, які ініціює ПОКУПЕЦЬ у власній транзакції, — не ця обгортка, а
 * `operator` з `withCustomerDb`/`withOrderTokenDb`/`withSessionDb`.
 */
export function withStoreOperatorDb<T>(
  fn: (db: ActorDb) => Promise<T>,
): Promise<T> {
  return withActor({ role: 'app_admin' }, (db) => fn(db));
}
