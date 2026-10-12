import { randomUUID } from 'node:crypto';
import { asc } from 'drizzle-orm';
import type { ActorDb } from 'simplycms/db';
import { mailOutbox } from 'simplycms/schema';

import { asService, errorText, runBatch } from './outbox-delivery';
import { getMailTransport } from './transport';
import type { MailMessage, MailTransport } from './types';

/** Скільки хвостів опортуністично добирає `deliverMail` (Е8-Р10). */
export const MAIL_RETRY_BATCH = 5;

/**
 * Набір видів розширюваний, тож `kind` у БД — просто `text` без CHECK
 * (рішення оркестратора): контракт — цей тип, а новий вид не потребує міграції.
 */
export type MailKind =
  'password_reset' | 'owner_invite' | 'order_customer' | 'order_owner';

export type MailItem = { kind: MailKind; message: MailMessage };

/** Рядок картки хвостів: свідомо БЕЗ `message` (посилання скидання — секрет). */
export type MailOutboxRow = {
  id: string;
  kind: MailKind;
  requestedAt: Date;
  attempts: number;
  lastError: string | null;
};

/**
 * Перша фаза: лист у ТІЙ САМІЙ транзакції, що й подія, яка його породила.
 * Відкат прибирає обидва. Повертає id рядків для `deliverMail`.
 */
export async function enqueueMail(
  db: ActorDb,
  items: readonly MailItem[],
): Promise<string[]> {
  if (items.length === 0) return [];
  const ids = items.map(() => randomUUID());
  await db.insert(mailOutbox).values(
    items.map((item, i) => ({
      id: ids[i]!,
      kind: item.kind,
      message: item.message,
    })),
  );
  return ids;
}

/**
 * Постановка власною транзакцією — для листів поза транзакцією події (скидання
 * пароля, запрошення). На відміну від `scheduleMediaErasures` КИДАЄ: збій
 * запису тут — це лист, що не потрапив у чергу й зник би без сліду, а не хвіст
 * прибирання, який підбере sweep.
 */
export function scheduleMail(items: readonly MailItem[]): Promise<string[]> {
  return asService((db) => enqueueMail(db, items));
}

/**
 * Друга фаза: надіслати `ids` ПІСЛЯ COMMIT транзакції-власниці, далі добрати
 * до `MAIL_RETRY_BATCH` хвостів старших за хвилину (таймера немає). Не кидає:
 * це хвіст події, що вже відбулась; слід лишається в outbox.
 */
export async function deliverMail(
  ids: readonly string[],
  transport: MailTransport = getMailTransport(),
): Promise<void> {
  try {
    if (ids.length > 0)
      await runBatch(transport, { ids, limit: ids.length, minAge: false });
    await runBatch(transport, {
      exclude: ids,
      limit: MAIL_RETRY_BATCH,
      minAge: true,
    });
  } catch (error) {
    console.warn('[simplycms/mail] deliver failed', errorText(error));
  }
}

/**
 * Явний повтор (кнопка в адмінці): без обмеження за віком. На відміну від
 * `deliverMail` кидає помилку БД — оператор мусить її побачити.
 */
export function retryMail(
  limit: number = MAIL_RETRY_BATCH,
  transport: MailTransport = getMailTransport(),
): Promise<{ sent: number; failed: number }> {
  return runBatch(transport, { limit, minAge: false });
}

/** Хвости від найстаріших для картки адмінки; `message` не читається. */
export async function listMailOutbox(db: ActorDb): Promise<MailOutboxRow[]> {
  const rows = await db
    .select({
      id: mailOutbox.id,
      kind: mailOutbox.kind,
      requestedAt: mailOutbox.requestedAt,
      attempts: mailOutbox.attempts,
      lastError: mailOutbox.lastError,
    })
    .from(mailOutbox)
    .orderBy(asc(mailOutbox.requestedAt));
  return rows.map((r) => ({ ...r, kind: r.kind as MailKind }));
}
