/**
 * `simplycms/db` — db-рантайм серверного контуру v2 (Task 6, В2-К1а).
 *
 * Публічна поверхня навмисно вузька: транзакційна обгортка актора, гасіння
 * пулу й транзакційний advisory-lock (Е6в-15: єдина SQL-реалізація).
 * `getDbPool` тут НЕ реекспортується — інакше заборона на
 * `simplycms/db/client` обходилася б через барель одним символом, і обидва
 * тихі режими відмови (запит без `SET LOCAL ROLE`, claims поза транзакцією)
 * повернулися б.
 */
export { withActor, type ActorDb } from './with-actor';
export { advisoryXactLock } from './advisory-lock';
export type { Actor, ActorRole } from './actor';
export { closeDbPool } from './client';
