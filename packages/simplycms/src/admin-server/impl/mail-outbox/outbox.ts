import { listMailOutbox, retryMail, type MailOutboxRow } from 'simplycms/mail';
import { requireGrant } from 'simplycms/auth';
import { runAdmin } from '../run';

/**
 * Хвости пошти для картки в налаштуваннях (Е8-Р9: право `settings.manage`).
 * Рядки БЕЗ тіла листа: `listMailOutbox` його не читає, бо посилання скидання
 * пароля — секрет, якому в UI адмінки робити нічого.
 */
export const listMailOutboxOp = (): Promise<MailOutboxRow[]> =>
  runAdmin('settings.manage', (db) => listMailOutbox(db));

/**
 * Кнопка «Повторити» (Е8-Р10): таймера немає, тож це другий шлях добору, окрім
 * опортуністичного. `requireGrant`, а не `runAdmin`: повтор відкриває власні
 * короткі транзакції, порожня зовнішня не потрібна (як `retryMediaErasuresOp`).
 */
export const retryMailOutboxOp = async (): Promise<{
  sent: number;
  failed: number;
}> => {
  await requireGrant('settings.manage');
  return retryMail();
};
