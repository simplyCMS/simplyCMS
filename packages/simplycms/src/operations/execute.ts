import {
  ValidationError,
  sanitizeValidationIssues,
} from 'simplycms/contracts/domain-errors';
import {
  dbRoleForSubject,
  requireOperation,
  type AuthzSubject,
  type CoreActor,
} from 'simplycms/auth';
import { toAdminConflict, withActor } from 'simplycms/db';
import type { ExecuteResult, IdempotencyRequest, OperationDef } from './define';

const actorOf = (subject: AuthzSubject): CoreActor =>
  subject.userId === null
    ? { kind: 'system' }
    : { kind: 'admin', userId: subject.userId };

/**
 * ЄДИНИЙ виконавець операцій реєстру (serverFn і HTTP йдуть крізь нього).
 *
 * Порядок (І14): 1) право й scopes токена → `AuthzError`; 2) валідація →
 * `ValidationError` лише з білого списку (path + код, без сирого вводу);
 * 3) транзакція під актором суб'єкта, конфлікти БД → `AdminConflictError`.
 * 🔴 Статусів відповіді НЕ ставить: виконавець кличуть і поза HTTP-запитом
 * (тести, CLI), де `setResponseStatus` сам кидає. Статус — справа межі.
 *
 * `opts.idempotency` лише проходить у сигнатурі: його механіку (перша дія
 * транзакції: збережена відповідь або вставка ключа) додає HTTP-шар.
 */
export async function executeOperation<I, O>(
  def: OperationDef<I, O>,
  raw: unknown,
  subject: AuthzSubject,
  opts: { readonly idempotency?: IdempotencyRequest } = {},
): Promise<ExecuteResult<O>> {
  requireOperation(subject, def.permission, def.id);
  const parsed = def.input.safeParse(raw);
  if (!parsed.success)
    throw new ValidationError(sanitizeValidationIssues(parsed.error.issues));
  void opts.idempotency; // механіка — Task 7
  const actor = actorOf(subject);
  try {
    const output = await withActor(
      {
        role: dbRoleForSubject(subject),
        userId: subject.userId ?? undefined,
      },
      (db) => def.run({ subject, actor, db }, parsed.data),
    );
    return { replayed: false, output };
  } catch (error) {
    throw toAdminConflict(error) ?? error;
  }
}
