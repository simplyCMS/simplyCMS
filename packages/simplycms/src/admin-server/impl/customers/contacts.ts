import { eq, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { profiles, users } from 'simplycms/schema';
import { ADMIN_STATE_CONSTRAINT } from 'simplycms/contracts/domain-errors';
import { advisoryXactLock } from 'simplycms/db';
import { customerCategoryLock } from 'simplycms/commerce';
import { AdminConflictError, stateConflict } from '../errors';
import { runAdminTransactions } from '../run';
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
 * Одна транзакція. ПЕРШИМ запитом — `customer-category:<userId>` (як у
 * `deleteCustomer`): конкурент (автоправило чи ручна категорія) тримає
 * `profiles FOR UPDATE` і вставляє `user_category_history`, а FK історії на
 * `users` бере `FOR KEY SHARE`, що конфліктує з нашим `users FOR UPDATE`
 * (`40P01`). Далі `users … FOR UPDATE` → email нормалізується (нижній
 * регістр). Відрізняється лише регістром збереженого — його переписано в
 * нижній регістр без скидання підтвердження й токенів (адреса та сама).
 * Змінився → зайнятість по `lower(email)` серед ІНШИХ користувачів
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
  await runAdminTransactions('customer.manage', async (transaction) => {
    try {
      await transaction(async (db) => {
        await advisoryXactLock(db, customerCategoryLock(input.userId));
        const [current] = await db
          .select({ email: users.email })
          .from(users)
          .where(eq(users.id, input.userId))
          .for('update');
        if (!current) stateConflict(ADMIN_STATE_CONSTRAINT.customerNotFound);
        const name = [input.firstName, input.lastName]
          .filter(Boolean)
          .join(' ');
        if (current.email.toLowerCase() !== email) {
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
          // Той самий email за змістом: регістр вирівнюється, `email_verified` ні.
          await db
            .update(users)
            .set({ name, email })
            .where(eq(users.id, input.userId));
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
      // Транзакція вже зіставила 23505 у конфлікт — для email це помилка
      // поля (Е6г-1). Зіставлення — ВСЕРЕДИНІ межі операції, щоб 400 їй
      // поставила межа (С-10), а не залишився 409 конфлікту.
      if (
        error instanceof AdminConflictError &&
        error.constraint === 'users_email_key'
      )
        fieldIssue(['email'], 'taken');
      throw error;
    }
  });
  return { email };
};
