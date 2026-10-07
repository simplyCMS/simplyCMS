import {
  requireGrant,
  dbRoleForSubject,
  type Operation,
  type RequestGrant,
} from 'simplycms/auth';
import { withActor, type ActorDb } from 'simplycms/db';
import { toAdminConflict } from './errors';

/** Окрема транзакція під актором гранта (мапінг конфліктів БД у 409). */
export type AdminTransaction = <T>(
  body: (db: ActorDb) => Promise<T>,
) => Promise<T>;

/**
 * ЄДИНА склейка К3-13 для адмін-операцій — фабричних і іменованих.
 * `runAdmin` — її форма «одна операція = одна транзакція»; ця — «одна
 * перевірка гранта, кілька коротких транзакцій» для пакетних операцій, де
 * кожен елемент мусить мати власну транзакцію (Е6в-19: «Запустити всі
 * правила» — кожен покупець окремо, щоб тисячі профілів не тримали локи
 * однієї довгої транзакції).
 *
 * 🔴 scope: адмін-поверхня обслуговує лише 'any'. 'own'-звуження
 * (замовлення/профілі покупця, Е5+) пишеться операцією, яка приймає
 * grant і ЯВНО звужує запит, — через окремий хелпер, не цей.
 * 🔴 requireGrant — ДО withActor: він сам ходить у user_roles короткою
 * транзакцією, вкладеної бути не може.
 */
export async function runAdminTransactions<Out>(
  operation: Operation,
  fn: (transaction: AdminTransaction, grant: RequestGrant) => Promise<Out>,
): Promise<Out> {
  const grant = await requireGrant(operation);
  if (grant.scope !== 'any')
    throw new Error(
      `[admin-server] операція ${operation} дала scope '${grant.scope}' — адмін-поверхня обслуговує лише 'any'`,
    );
  const actor = {
    role: dbRoleForSubject(grant.subject),
    userId: grant.subject.userId ?? undefined,
  };
  const transaction: AdminTransaction = async (body) => {
    try {
      return await withActor(actor, body);
    } catch (error) {
      throw toAdminConflict(error) ?? error;
    }
  };
  return fn(transaction, grant);
}

/** Одна адмін-операція = одна транзакція (К3-13). */
export async function runAdmin<Out>(
  operation: Operation,
  fn: (db: ActorDb, grant: RequestGrant) => Promise<Out>,
): Promise<Out> {
  return runAdminTransactions(operation, (transaction, grant) =>
    transaction((db) => fn(db, grant)),
  );
}
