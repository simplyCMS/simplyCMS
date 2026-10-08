import {
  requireGrant,
  dbRoleForSubject,
  type Operation,
  type RequestGrant,
} from 'simplycms/auth';
import { setResponseStatus } from '@tanstack/react-start/server';
import { withActor, type ActorDb } from 'simplycms/db';
import { AdminConflictError, ValidationError, toAdminConflict } from './errors';

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
 * 🔴 Статус відповіді ставить ЛИШЕ ця межа (С-10): доменна помилка, що
 * вилетіла з `fn` — із транзакції чи з коду між транзакціями, —
 * отримує 409/400 ДО повторного throw (К3-13: сервер бере статус із
 * відповіді в момент catch, не з полів Error). Ядра статус не чіпають,
 * тож їх можна кликати поза HTTP-запитом.
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
  try {
    return await fn(transaction, grant);
  } catch (error) {
    if (error instanceof AdminConflictError) setResponseStatus(409);
    else if (error instanceof ValidationError) setResponseStatus(400);
    throw error;
  }
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
