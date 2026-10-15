import { AdminConflictError } from 'simplycms/contracts/domain-errors';

// Класи доменних помилок живуть у T0 (`contracts/domain-errors`); тут лишився
// лише серверний мапінг кодів Postgres (UPSTREAM:DRZ-1).

const KIND_BY_CODE: Record<string, AdminConflictError['kind']> = {
  '23505': 'unique',
  '23503': 'reference',
};

/**
 * Drizzle перезагортає помилку драйвера (борг К1а-5): код Postgres — у
 * `.cause`. Повертає конфлікт або null (тоді помилка летить як є, 500).
 * Без побічного ефекту: 409 ставить межа операції (С-10).
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
  return new AdminConflictError(kind, constraint ?? null);
}
