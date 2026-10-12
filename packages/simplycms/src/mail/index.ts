// Порт пошти — server-only піддерево (`contracts/server-only`): `nodemailer` і
// секрет у `SMTP_URL`. Драйвер обирає група env (`resolveDriverEnv`), не код магазину.
export type { MailMessage, MailTransport } from './types';
export { logTransport } from './log';
export { smtpTransport } from './smtp';
export { getMailTransport, selectMailTransport } from './transport';
export {
  MAIL_RETRY_BATCH,
  deliverMail,
  enqueueMail,
  listMailOutbox,
  retryMail,
  scheduleMail,
} from './outbox';
export type { MailItem, MailKind, MailOutboxRow } from './outbox';
export { renderOwnerInviteMail, renderPasswordResetMail } from './render/auth';
export type {
  OwnerInviteMailInput,
  PasswordResetMailInput,
} from './render/auth';
