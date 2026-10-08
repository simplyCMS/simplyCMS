import type { Translator } from 'simplycms/i18n';

/**
 * Текст відмови входу забаненому (Е6г-13): переклад + контакти магазину.
 * Відсутній контакт не показується; без жодного — лише базова фраза, щоб не
 * лишати «Звʼяжіться з магазином: » з висячою двокрапкою.
 */
export function bannedMessage(
  t: Translator,
  contacts: { phone: string | null; email: string | null },
): string {
  const list = [contacts.phone, contacts.email].filter(Boolean).join(', ');
  return list
    ? t('auth.login.bannedContacts', { contacts: list })
    : t('auth.login.banned');
}
