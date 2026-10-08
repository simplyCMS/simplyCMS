import { and, eq, like, or } from 'drizzle-orm';
import { inviteIdentifier } from 'simplycms/auth';
import type { ActorDb } from 'simplycms/db';
import { verifications } from 'simplycms/schema';

/**
 * Відкликає токени, прив'язані до користувача або його email (Е6г-2).
 * Кличуть зміна email (зі СТАРИМ email) і видалення покупця.
 *
 * У BA 1.7.7 скидання пароля пише `reset-password:<token>` зі
 * `value = userId`; email-ідентифікатор має лише наш invite власника. Без
 * цього токен, випущений до зміни email, лишався б чинним для адреси,
 * якою покупець більше не володіє. Повертає кількість видалених рядків.
 */
export async function revokeUserVerifications(
  db: ActorDb,
  { userId, email }: { userId: string; email: string },
): Promise<number> {
  const removed = await db
    .delete(verifications)
    .where(
      or(
        and(
          like(verifications.identifier, 'reset-password:%'),
          eq(verifications.value, userId),
        ),
        eq(verifications.identifier, inviteIdentifier(email)),
      ),
    )
    .returning({ id: verifications.id });
  return removed.length;
}
