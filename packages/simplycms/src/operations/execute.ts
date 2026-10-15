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
import {
  reserveIdempotencyKey,
  storeIdempotentResponse,
} from './http/idempotency';
import { ProblemError } from './http/problem';
import { encodeOutput } from './http/wire';

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
 * `opts.idempotency` (лише HTTP): ключ резервується ПЕРШОЮ дією тієї самої
 * транзакції, що й команда, а відповідь 2xx дописується перед комітом
 * (`http/idempotency.ts`, К5). Повтор повертає `replayed: true` без `run`.
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
  const actor = actorOf(subject);
  const idem = opts.idempotency && { ...opts.idempotency, operation: def.id };
  try {
    return await withActor(
      {
        role: dbRoleForSubject(subject),
        userId: subject.userId ?? undefined,
      },
      async (db): Promise<ExecuteResult<O>> => {
        if (idem) {
          const reserved = await reserveIdempotencyKey(db, idem);
          if (reserved.kind === 'replay')
            return {
              replayed: true,
              status: reserved.status,
              body: reserved.body,
            };
          if (reserved.kind === 'mismatch')
            throw new ProblemError('idempotency_mismatch');
        }
        const output = await def.run({ subject, actor, db }, parsed.data);
        if (idem)
          await storeIdempotentResponse(
            db,
            idem,
            200,
            encodeOutput(def.output, output),
          );
        return { replayed: false, output };
      },
    );
  } catch (error) {
    throw toAdminConflict(error) ?? error;
  }
}
