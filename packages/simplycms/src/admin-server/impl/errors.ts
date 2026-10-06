import { setResponseStatus } from '@tanstack/react-start/server';
import {
  DOMAIN_ERROR_NAME,
  type AdminConflictKind,
  type AdminStateConstraint,
  type ValidationIssue,
} from 'simplycms/contracts/domain-errors';

/**
 * Помилка валідації вводу адмін-операції (Тема 12): Zod-відмова на межі
 * serverFn → типізована доменна помилка з issues крізь БІЛИЙ СПИСОК
 * (`sanitizeValidationIssues`: path + код + параметри схеми, без сирих
 * повідомлень Zod і без відлуння вводу). Клієнт показує її помилками
 * полів (`applyServerValidation`), а не сирим JSON у тості.
 *
 * `message` навмисно загальний: вміст issues — не для користувача, а
 * `issues` переживає межу `domainErrorAdapter` окремим каналом.
 */
export class ValidationError extends Error {
  override readonly name = DOMAIN_ERROR_NAME.validation;
  readonly issues: readonly ValidationIssue[];
  constructor(issues: readonly ValidationIssue[]) {
    super('[admin-server] помилка валідації вводу');
    this.issues = issues;
  }
}

/**
 * Конфлікт із даними, який власник може виправити сам (Е3-7): дубль
 * унікального значення, посилання, що тримає рядок, або (Е5-9, `state`)
 * заборонений перехід доменного стану — його кидає іменована операція
 * сама, разом із `setResponseStatus(409)`. Окремий клас — щоб
 * клієнт показав зрозумілий тост за `error.name`. `name` і поля
 * (`kind`/`constraint`) — за T0-переліком `contracts/domain-errors`: його
 * читає й клієнтський `domainErrorAdapter` (Е3-20), що зберігає instanceof
 * і поля через межу serverFn (раніше seroval губив усе, крім `.message`,
 * як і в `AuthzError` — К3-13).
 */
export class AdminConflictError extends Error {
  override readonly name = DOMAIN_ERROR_NAME.adminConflict;
  constructor(
    readonly kind: AdminConflictKind,
    readonly constraint: string | null,
  ) {
    super(
      `[admin-server] конфлікт ${kind}: ${constraint ?? 'невідоме обмеження'}`,
    );
  }
}

/**
 * 409 правила стану (Е5б-10, Е6а-12): статус — ДО throw (К3-13). Спільний
 * для іменованих операцій і guard-хуків фабрики (Е6а-16).
 */
export function stateConflict(constraint: AdminStateConstraint): never {
  setResponseStatus(409);
  throw new AdminConflictError('state', constraint);
}

const KIND_BY_CODE: Record<string, AdminConflictError['kind']> = {
  '23505': 'unique',
  '23503': 'reference',
};

/**
 * Drizzle перезагортає помилку драйвера (борг К1а-5): код Postgres — у
 * `.cause`. Повертає конфлікт або null (тоді помилка летить як є, 500).
 * 🔴 Статус ставиться ДО throw — сервер бере його з getResponse().status
 * у момент catch, не з полів Error (К3-13).
 * UPSTREAM:DRZ-1 — docs/architecture/upstream-workarounds.md
 */
export function toAdminConflict(error: unknown): AdminConflictError | null {
  const cause = (error as { cause?: unknown })?.cause ?? error;
  const { code, constraint } = (cause ?? {}) as {
    code?: string;
    constraint?: string;
  };
  const kind = code ? KIND_BY_CODE[code] : undefined;
  if (!kind) return null;
  setResponseStatus(409);
  return new AdminConflictError(kind, constraint ?? null);
}
