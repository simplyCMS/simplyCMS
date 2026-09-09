import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { z } from 'zod';
import { readSessionSubject } from 'simplycms/auth';
import {
  clearDefaultRecipients,
  createRecipient,
  deleteRecipient,
  loadRecipients,
  updateRecipient,
  withCustomerDb,
  type ActorDb,
  type RecipientRow,
} from 'simplycms/storefront/loaders';

export type { RecipientRow };

/** Поля форми отримувача. `id` відсутній — створення, заданий — редагування. */
const recipientInput = z.object({
  id: z.string().uuid().nullable().optional(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().min(1).max(30),
  email: z.string().max(200).nullable(),
  city: z.string().min(1).max(100),
  address: z.string().min(1).max(300),
  notes: z.string().max(1000).nullable(),
  isDefault: z.boolean(),
});

/**
 * Отримувачі власника сесії.
 *
 * 🔴 `userId` у схемі входу немає в жодного з трьох викликів — він завжди з
 * cookie Better Auth. Причина та сама, що в `./user-addresses`.
 */
export const getMyRecipients = createServerFn({ method: 'GET' }).handler(
  async (): Promise<RecipientRow[]> =>
    withSessionDb((db, userId) => loadRecipients(db, userId)),
);

/**
 * Створити або оновити отримувача власника сесії.
 *
 * Повертає `null`, якщо рядок із таким `id` актору не належить.
 */
export const saveMyRecipient = createServerFn({ method: 'POST' })
  .inputValidator(recipientInput)
  .handler(async ({ data }): Promise<string | null> => {
    const input = data as z.infer<typeof recipientInput>;

    return withSessionDb(async (db, userId) => {
      if (input.isDefault) await clearDefaultRecipients(db, userId);

      if (!input.id) return createRecipient(db, userId, input);
      const ok = await updateRecipient(db, userId, input.id, input);
      return ok ? input.id : null;
    });
  });

/** Видалити власного отримувача; `false` — рядка немає або він чужий. */
export const deleteMyRecipient = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }): Promise<boolean> => {
    const { id } = data as { id: string };
    return withSessionDb((db, userId) => deleteRecipient(db, userId, id));
  });

/**
 * Транзакція від імені власника сесії — дублікат із `./user-addresses`
 * і з тієї самої причини (тір-зони + відсутність живого експорту).
 */
async function withSessionDb<T>(
  fn: (db: ActorDb, userId: string) => Promise<T>,
): Promise<T> {
  const subject = await readSessionSubject(getRequest().headers);
  if (!subject) {
    throw new Error(
      '[simplycms] Sign-in required: no session for this request.',
    );
  }
  return withCustomerDb(subject.userId, (db) => fn(db, subject.userId));
}
