import type { Translator } from 'simplycms/i18n';
import type { MailMessage } from '../types';
import { escapeHtml, layout, linkParagraph, paragraph } from './layout';

/**
 * Чисті рендери листів auth-контуру. Тексти — лише з каталогу `mail.*`
 * (транслятор `t` приходить ззовні, зазвичай від локалі хоста), кирилиці в коді
 * немає. Тема листа не несе посилання (`MailMessage.subject` друкується
 * log-драйвером у проді), посилання лише в тілі.
 */

export type PasswordResetMailInput = {
  to: string;
  url: string;
  storeName: string;
  t: Translator;
};

export type OwnerInviteMailInput = PasswordResetMailInput & {
  ttlMs: number;
};

/** Скільки годин лишилось жити токену — для тексту листа. */
const hours = (ttlMs: number): number =>
  Math.max(1, Math.round(ttlMs / 3_600_000));

export function renderPasswordResetMail(
  input: PasswordResetMailInput,
): MailMessage {
  const { to, url, storeName, t } = input;
  const params = { storeName };
  const intro = t('mail.reset.intro', params);
  const open = t('mail.reset.openLink');
  const ignore = t('mail.reset.ignore');
  return {
    to,
    kind: 'password_reset',
    subject: t('mail.reset.subject', params),
    text: `${intro}\n\n${open}\n${url}\n\n${ignore}`,
    html: layout(
      storeName,
      paragraph(escapeHtml(intro)) +
        linkParagraph(url, t('mail.reset.action')) +
        paragraph(escapeHtml(ignore)),
    ),
  };
}

/** Лист підтвердження пошти при реєстрації (Р30): та сама форма, що й у скиданні. */
export function renderEmailVerificationMail(
  input: PasswordResetMailInput,
): MailMessage {
  const { to, url, storeName, t } = input;
  const params = { storeName };
  const intro = t('mail.verify.intro', params);
  const open = t('mail.verify.openLink');
  const ignore = t('mail.verify.ignore');
  return {
    to,
    kind: 'email_verification',
    subject: t('mail.verify.subject', params),
    text: `${intro}\n\n${open}\n${url}\n\n${ignore}`,
    html: layout(
      storeName,
      paragraph(escapeHtml(intro)) +
        linkParagraph(url, t('mail.verify.action')) +
        paragraph(escapeHtml(ignore)),
    ),
  };
}

export function renderOwnerInviteMail(
  input: OwnerInviteMailInput,
): MailMessage {
  const { to, url, storeName, ttlMs, t } = input;
  const params = { storeName };
  const intro = t('mail.invite.intro', params);
  const open = t('mail.invite.openLink');
  const ttl = t('mail.invite.ttl', { hours: hours(ttlMs) });
  const ignore = t('mail.invite.ignore');
  return {
    to,
    kind: 'owner_invite',
    subject: t('mail.invite.subject', params),
    text: `${intro}\n\n${open}\n${url}\n\n${ttl} ${ignore}`,
    html: layout(
      storeName,
      paragraph(escapeHtml(intro)) +
        linkParagraph(url, t('mail.invite.action')) +
        paragraph(escapeHtml(`${ttl} ${ignore}`)),
    ),
  };
}
