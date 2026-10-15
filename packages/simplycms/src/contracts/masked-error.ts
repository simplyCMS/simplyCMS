import { isDomainErrorName } from './domain-errors';

/**
 * Формат повідомлення про непередбачену помилку, яке сервер у проді віддає
 * клієнту замість справжнього тексту (Р23): загальна фраза й ідентифікатор,
 * за яким власник знаходить повну помилку в лозі сервера.
 *
 * T0: нуль рантайм-залежностей — формат читають і сервер (`server-guard`, що
 * маскує), і клієнтський екран помилки (host `route-error.tsx`, що показує
 * ідентифікатор), тож він не може жити в server-only модулі.
 */
export const MASKED_ERROR_TEXT = 'Internal server error';

/** Повідомлення, що їде клієнту: загальний текст + ідентифікатор. */
export function maskedErrorMessage(id: string): string {
  return `${MASKED_ERROR_TEXT} [ref ${id}]`;
}

/** Ідентифікатор із повідомлення, збудованого `maskedErrorMessage`, або `null`. */
export function parseMaskedErrorRef(message: unknown): string | null {
  if (typeof message !== 'string') return null;
  return (
    /^Internal server error \[ref ([a-z0-9]+)\]$/.exec(message)?.[1] ?? null
  );
}

/** Що екран помилки може показати: власний текст (якщо безпечний) і ідентифікатор. */
export interface PublicErrorView {
  readonly message: string | null;
  readonly ref: string | null;
}

/**
 * Що з помилки можна показати відвідувачу. Текст — лише доменної помилки з
 * кодом (родина `DOMAIN_ERROR_NAME`: її повідомлення написане для людини) або
 * коли `expose` (dev). Решта — непередбачені: у проді їхній текст міг бути
 * справжнім SQL чи `host:port`, тож екран показує загальну фразу.
 */
export function describePublicError(
  error: unknown,
  expose: boolean,
): PublicErrorView {
  const rec =
    typeof error === 'object' && error !== null
      ? (error as Record<string, unknown>)
      : {};
  const message = typeof rec.message === 'string' ? rec.message : null;
  const safe = expose || isDomainErrorName(rec.name);
  return {
    message: safe ? message : null,
    ref: parseMaskedErrorRef(message),
  };
}
