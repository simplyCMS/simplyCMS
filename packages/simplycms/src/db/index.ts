/**
 * `simplycms/db` — db-рантайм серверного контуру v2 (Task 6, В2-К1а).
 *
 * Публічна поверхня навмисно вузька: транзакційна обгортка актора і гасіння
 * пулу. `getDbPool` тут НЕ реекспортується — інакше заборона на
 * `simplycms/db/client` обходилася б через барель одним символом, і обидва
 * тихі режими відмови (запит без `SET LOCAL ROLE`, claims поза транзакцією)
 * повернулися б.
 */
export { withActor, type ActorDb } from './with-actor';
export type { Actor, ActorRole } from './actor';
export { closeDbPool } from './client';
