import { createTransport } from 'nodemailer';
import type { MailTransport } from './types';

/** Код збою SMTP без деталей: повідомлення nodemailer може нести адресу й облікові дані. */
function smtpFailure(error: unknown): Error {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : 'UNKNOWN';
  return new Error(`SMTP: ${code}`);
}

/**
 * SMTP-драйвер на `nodemailer`.
 *
 * 🔴 Помилка несе лише `SMTP: <code>` і БЕЗ `cause`: `SMTP_URL` містить пароль, а
 * вихідна помилка бібліотеки (і її `command`/`response`) потрапляє в логи й у
 * картку хвостів пошти. Зʼєднання створюється ліниво — імпорт і збірка мережі
 * не потребують.
 */
export function smtpTransport(cfg: {
  url: string;
  from: string;
}): MailTransport {
  let transport: ReturnType<typeof createTransport> | undefined;
  return {
    driver: 'smtp',
    async send(m) {
      transport ??= createTransport(cfg.url);
      try {
        await transport.sendMail({
          from: cfg.from,
          to: m.to,
          subject: m.subject,
          text: m.text,
          html: m.html,
          replyTo: m.replyTo,
        });
      } catch (error) {
        throw smtpFailure(error);
      }
    },
  };
}
