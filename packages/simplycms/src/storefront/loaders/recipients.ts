import { userRecipients } from 'simplycms/schema';
import type { ActorDb } from './db';

/** Новий отримувач, збережений у книзі покупця під час оформлення. */
export interface NewRecipient {
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  city: string;
  address: string;
  notes: string | null;
}

/**
 * Додає отримувача покупцю.
 *
 * 🔴 `userId` ставить сервер, а не форма. Політика `user_recipients_own_all`
 * має WITH CHECK на власника, тож чужий id тут не пройшов би й у базу — але
 * покладатись на це як на єдиний рубіж не можна: актора однаково задає сервер.
 */
export async function createRecipient(
  db: ActorDb,
  userId: string,
  input: NewRecipient,
): Promise<string> {
  const [row] = await db
    .insert(userRecipients)
    .values({
      userId,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      email: input.email,
      city: input.city,
      address: input.address,
      notes: input.notes,
    })
    .returning({ id: userRecipients.id });

  return row.id;
}
