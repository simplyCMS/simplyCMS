// Таблиці `kind` → статус/заголовок і форма тіла problem+json (майстер §3.3).

/** `kind` проблеми (майстер §3.3) → HTTP-статус: єдина таблиця статусів. */
export const PROBLEM_STATUS = {
  validation: 400,
  unauthenticated: 401,
  forbidden: 403,
  unknown_operation: 404,
  not_found: 404,
  method_not_allowed: 405,
  conflict: 409,
  reference: 409,
  language_in_use: 409,
  source_changed: 409,
  idempotency_in_flight: 409,
  version_mismatch: 412,
  unsupported_media_type: 415,
  idempotency_mismatch: 422,
  internal: 500,
} as const;

export type ProblemKind = keyof typeof PROBLEM_STATUS;

/** Стабільні англійські заголовки: клієнт не парсить `detail`. */
export const TITLE: Record<ProblemKind, string> = {
  validation: 'Validation failed',
  unauthenticated: 'Authentication required',
  forbidden: 'Forbidden',
  unknown_operation: 'Unknown operation',
  not_found: 'Not found',
  method_not_allowed: 'Method not allowed',
  conflict: 'Conflict',
  reference: 'Referenced by other data',
  language_in_use: 'Language is in use',
  source_changed: 'Translation source changed',
  idempotency_in_flight: 'Request with this key is in flight',
  version_mismatch: 'Version mismatch',
  unsupported_media_type: 'Unsupported media type',
  idempotency_mismatch: 'Idempotency key reused with another request',
  internal: 'Internal error',
};

/** Тіло `application/problem+json` (RFC 9457) + розширення контракту. */
export interface ProblemBody {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly kind: ProblemKind;
  readonly operation: string;
  readonly detail?: string;
  /** Лише для 400: шлях і код, без сирого вводу. */
  readonly errors?: readonly {
    path: readonly (string | number)[];
    code: string;
  }[];
  readonly currentVersion?: number;
  readonly currentSourceHashes?: Readonly<Record<string, string>>;
  /** Лише для 409 з відомим власником значення: які сутності його займають. */
  readonly conflicts?: readonly { type: string; id: string; path: string }[];
}

export type ProblemExtra = Omit<
  ProblemBody,
  'type' | 'title' | 'status' | 'kind' | 'operation'
>;
