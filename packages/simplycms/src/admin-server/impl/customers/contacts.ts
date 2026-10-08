import { eq, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { profiles, users } from 'simplycms/schema';
import { AdminConflictError } from '../errors';
import { runAdmin } from '../run';
import { fieldIssue, parseAdminInput } from '../validation';
import { revokeUserVerifications } from './verifications';

export const updateCustomerContactsInput = z.object({
  userId: z.uuid(),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().max(100).nullable(),
  phone: z.string().trim().max(30).nullable(),
  // `z.email()` крайових пробілів не прибирає, тож `trim` — ДО нього.
  email: z.string().trim().pipe(z.email()),
});

/**
 * Контакти й email покупця з картки (Е6г-1, Е6г-2), `customer.manage`.
 *
 * Одна транзакція: `users … FOR UPDATE` → email нормалізується (нижній
 * регістр). Змінився → зайнятість по `lower(email)` серед ІНШИХ користувачів
 * дає помилку поля `taken` ДО будь-якого запису; далі `email_verified =
 * false` і відкликання токенів зі СТАРИМ email. Гонку з вставкою, якої
 * перевірка не бачить (READ COMMITTED), ловить унікальний індекс
 * `users_email_key` — це та сама помилка поля. Сесії не чіпаються.
 */
export const updateCustomerContactsOp = async ({
  data,
}: {
  data: z.input<typeof updateCustomerContactsInput>;
}): Promise<{ email: string }> => {
  const input = parseAdminInput(updateCustomerContactsInput, data);
  const email = input.email.toLowerCase();
  try {
    await runAdmin('customer.manage', async (db) => {
      const [current] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, input.userId))
        .for('update');
      if (!current)
        throw new Error(`[admin-server] покупця ${input.userId} не існує`);
      const name = [input.firstName, input.lastName].filter(Boolean).join(' ');
      if (current.email !== email) {
        const [clash] = await db
          .select({ id: users.id })
          .from(users)
          .where(
            sql`lower(${users.email}) = ${email} and ${ne(users.id, input.userId)}`,
          )
          .limit(1);
        if (clash) fieldIssue(['email'], 'taken');
        await db
          .update(users)
          .set({ email, emailVerified: false, name })
          .where(eq(users.id, input.userId));
        await revokeUserVerifications(db, {
          userId: input.userId,
          email: current.email,
        });
      } else {
        await db.update(users).set({ name }).where(eq(users.id, input.userId));
      }
      const contacts = {
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        email,
      };
      const updated = await db
        .update(profiles)
        .set(contacts)
        .where(eq(profiles.userId, input.userId))
        .returning({ id: profiles.id });
      if (updated.length === 0)
        await db.insert(profiles).values({
          id: crypto.randomUUID(),
          userId: input.userId,
          ...contacts,
        });
    });
  } catch (error) {
    // `runAdmin` уже зіставив 23505 у 409 — для email це помилка поля (Е6г-1).
    if (
      error instanceof AdminConflictError &&
      error.constraint === 'users_email_key'
    )
      fieldIssue(['email'], 'taken');
    throw error;
  }
  return { email };
};
