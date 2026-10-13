/**
 * 🔴 Server-only (contracts/server-only): охорона серверного входу — маскування
 * непередбачених помилок у проді (Р23) і заголовки безпеки (Р27). Host
 * підключає її в `src/start.ts` (function-middleware) і `src/server.ts`
 * (обгортка fetch); логіка тут, у host лише склейка.
 */
export {
  isMaskableError,
  maskAround,
  maskUnexpectedError,
  toMaskedPayload,
  type MaskOptions,
} from './mask-errors';
export {
  HSTS_HEADER,
  SECURITY_HEADERS,
  securityHeaders,
  withSecurityHeaders,
} from './security-headers';
