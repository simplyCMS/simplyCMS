import { resolveDriverEnv, type MailEnv } from 'simplycms/env';
import { logTransport } from './log';
import { smtpTransport } from './smtp';
import type { MailTransport } from './types';

/** Транспорт за вже розвʼязаною групою env (чиста відповідність, без кешу). */
export function selectMailTransport(mail: MailEnv): MailTransport {
  return mail.driver === 'smtp' ? smtpTransport(mail) : logTransport();
}

let cached: MailTransport | null = null;

/**
 * Дефолтний транспорт магазину. Мемоізований при ПЕРШОМУ виклику (не на рівні
 * модуля): тоді `process.env` уже наповнено `server.mjs`. Часткова група
 * `SMTP_URL`/`MAIL_FROM` кидає `DriverEnvError` — гучно, а не мовчазний `log`.
 */
export function getMailTransport(): MailTransport {
  cached ??= selectMailTransport(resolveDriverEnv(process.env).mail);
  return cached;
}
