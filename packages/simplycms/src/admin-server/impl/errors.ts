import { setResponseStatus } from '@tanstack/react-start/server';
import { DOMAIN_ERROR_NAME } from 'simplycms/contracts/domain-errors';

/**
 * Конфлікт із даними, який власник може виправити сам (Е3-7): дубль
 * унікального значення або посилання, що тримає рядок. Окремий клас — щоб
 * клієнт показав зрозумілий тост за `error.name`. `name` і поля
 * (`kind`/`constraint`) — за T0-переліком `contracts/domain-errors`: його
 * читає й клієнтський `domainErrorAdapter` (Е3-20), що зберігає instanceof
 * і поля через межу serverFn (раніше seroval губив усе, крім `.message`,
 * як і в `AuthzError` — К3-13).
 */
export class AdminConflictError extends Error {
  override readonly name = DOMAIN_ERROR_NAME.adminConflict;
  constructor(
    readonly kind: 'unique' | 'reference',
    readonly constraint: string | null,
  ) {
    super(
      `[admin-server] конфлікт ${kind}: ${constraint ?? 'невідоме обмеження'}`,
    );
  }
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
