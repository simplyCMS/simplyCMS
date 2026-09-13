import { withActor, type Actor, type ActorDb } from 'simplycms/db';
import {
  escalationFor,
  type EscalationState,
  type OperatorEscalation,
} from './escalation';

export type { ActorDb };
export type { OperatorEscalation } from './escalation';

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
 * Транзакція ЗАЛОГІНЕНОГО покупця: `app_user` + GUC `app.user_id`, плюс
 * `operator` — службова дія ВСЕРЕДИНІ цієї транзакції під `app_admin`
 * (списання/повернення залишку, скасування замовлення). Реалізація й повна
 * причина — `./escalation`; правило використання — `data-access.
 * instructions.md`, «Ескалація ролі покупцем»: `operator` кличеться ЛИШЕ
 * ПІСЛЯ того, як RLS уже прийняла читання чи запис покупця в ЦІЙ транзакції,
 * і лише для обліку магазину — ніколи для читання чи запису чужих рядків.
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
  const state: EscalationState = { finished: false };
  return withActor(actor, (db, client) =>
    fn(db, escalationFor(client, db, actor, state)),
  ).finally(() => {
    state.finished = true;
  });
}

/**
 * Транзакція ГОСТЬОВОГО замовлення: `app_user` + GUC `app.order_token`,
 * плюс `operator` — те саме, що в `withCustomerDb`.
 *
 * Гість не має ідентичності — його доступ до одного замовлення доводить
 * одноразовий токен із посилання (`orders_select_own_or_token`).
 */
export function withOrderTokenDb<T>(
  orderToken: string,
  fn: (db: ActorDb, operator: OperatorEscalation) => Promise<T>,
): Promise<T> {
  const actor: Actor = { role: 'app_user', orderToken };
  const state: EscalationState = { finished: false };
  return withActor(actor, (db, client) =>
    fn(db, escalationFor(client, db, actor, state)),
  ).finally(() => {
    state.finished = true;
  });
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
