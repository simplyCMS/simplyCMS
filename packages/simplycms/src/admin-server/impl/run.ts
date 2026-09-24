import {
  requireGrant,
  dbRoleForSubject,
  type Operation,
  type RequestGrant,
} from 'simplycms/auth';
import { withActor, type ActorDb } from 'simplycms/db';
import { toAdminConflict } from './errors';

/**
 * ЄДИНА склейка К3-13 для адмін-операцій — фабричних і іменованих
 * (дедуплікація: до Е3 кожна іменована операція повторювала
 * requireGrant → withActor власноруч і scope не читала взагалі).
 *
 * 🔴 scope: адмін-поверхня обслуговує лише 'any'. 'own'-звуження
 * (замовлення/профілі покупця, Е5+) пишеться операцією, яка приймає
 * grant і ЯВНО звужує запит, — через окремий хелпер, не цей.
 * 🔴 requireGrant — ДО withActor: він сам ходить у user_roles короткою
 * транзакцією, вкладеної бути не може.
 */
export async function runAdmin<Out>(
  operation: Operation,
  fn: (db: ActorDb, grant: RequestGrant) => Promise<Out>,
): Promise<Out> {
  const grant = await requireGrant(operation);
  if (grant.scope !== 'any')
    throw new Error(
      `[admin-server] операція ${operation} дала scope '${grant.scope}' — адмін-поверхня обслуговує лише 'any'`,
    );
  try {
    return await withActor(
      {
        role: dbRoleForSubject(grant.subject),
        userId: grant.subject.userId ?? undefined,
      },
      (db) => fn(db, grant),
    );
  } catch (error) {
    throw toAdminConflict(error) ?? error;
  }
}
