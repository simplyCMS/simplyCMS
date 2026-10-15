import { AdminConflictError } from 'simplycms/contracts/domain-errors';

/**
 * Помилки Postgres у вигляді, придатному для доменного коду — ЄДИНИЙ розбір
 * обгортки драйвера в репо. Drizzle перезагортає помилку `pg` (борг К1а-5):
 * код Postgres і ім'я обмеження лежать у `.cause`, а не на самій помилці.
 * Решта (`toAdminConflict`, `isUniqueViolation`, `isForeignKeyViolation`)
 * стоїть на цьому розборі — копій немає, тож зміна форми помилки правиться в
 * одному місці. UPSTREAM:DRZ-1 — docs/architecture/upstream-workarounds.md
 */
export function pgErrorInfo(error: unknown): {
  code?: string;
  constraint?: string;
} {
  const cause = (error as { cause?: unknown })?.cause ?? error;
  const { code, constraint } = (cause ?? {}) as {
    code?: string;
    constraint?: string;
  };
  return { code, constraint };
}

/** `unique_violation` (23505), за потреби — саме на цьому обмеженні. */
export function isUniqueViolation(
  error: unknown,
  constraint?: string,
): boolean {
  const info = pgErrorInfo(error);
  return (
    info.code === '23505' &&
    (constraint === undefined || info.constraint === constraint)
  );
}

/** `foreign_key_violation` (23503): рядок, на який посилаються, чи відсутня ціль. */
export function isForeignKeyViolation(error: unknown): boolean {
  return pgErrorInfo(error).code === '23503';
}

const KIND_BY_CODE: Record<string, AdminConflictError['kind']> = {
  '23505': 'unique',
  '23503': 'reference',
};

/**
 * Помилка БД → конфлікт або null (тоді помилка летить як є, 500). Без
 * побічного ефекту: статус відповіді ставить межа операції (С-10).
 */
export function toAdminConflict(error: unknown): AdminConflictError | null {
  const { code, constraint } = pgErrorInfo(error);
  const kind = code ? KIND_BY_CODE[code] : undefined;
  if (!kind) return null;
  return new AdminConflictError(kind, constraint ?? null);
}
