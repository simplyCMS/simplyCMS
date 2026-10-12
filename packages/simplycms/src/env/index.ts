/**
 * 🔴 Server-only (contracts/server-only): резолвер груп env драйверів
 * сховища й пошти за правилом «все або нічого». Чиста функція над
 * переданим оточенням — `process.env` викликач читає сам, у рантаймі.
 */
export {
  S3_KEYS,
  SMTP_KEYS,
  DriverEnvError,
  resolveDriverEnv,
  describeDriverEnv,
  checkDriverEnvOnStart,
  isProductionRuntime,
} from './resolve';
export { redactUrls } from './redact';
export { siteUrl } from './site-url';
export type { MediaEnv, MailEnv, DriverEnv } from './resolve';
