import { and, count, desc, eq } from 'drizzle-orm';
import { orders, userRecipients } from 'simplycms/schema';
import type { ActorDb } from './db';

/** Отримувач із книги покупця разом із лічильником замовлень на нього. */
export interface RecipientRow {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  city: string;
  address: string;
  notes: string | null;
  is_default: boolean;
  usage_count: number;
}

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

/** Поля отримувача разом із прапорцем «основний» (форма кабінету). */
export interface RecipientInput extends NewRecipient {
  isDefault: boolean;
}

/**
 * Отримувачі покупця з лічильником використань.
 *
 * 🔴 Той самий N+1, що й в адресах: браузер брав список і добивав `count` на
 * кожен рядок. Джойн на `orders` звужений політикою — чужі замовлення в
 * лічильник не потрапляють.
 */
export async function loadRecipients(
  db: ActorDb,
  userId: string,
): Promise<RecipientRow[]> {
  const rows = await db
    .select({
      id: userRecipients.id,
      first_name: userRecipients.firstName,
      last_name: userRecipients.lastName,
      phone: userRecipients.phone,
      email: userRecipients.email,
      city: userRecipients.city,
      address: userRecipients.address,
      notes: userRecipients.notes,
      is_default: userRecipients.isDefault,
      created_at: userRecipients.createdAt,
      usage_count: count(orders.id),
    })
    .from(userRecipients)
    .leftJoin(orders, eq(orders.savedRecipientId, userRecipients.id))
    .where(eq(userRecipients.userId, userId))
    .groupBy(userRecipients.id)
    .orderBy(desc(userRecipients.isDefault), desc(userRecipients.createdAt));

  return rows.map(({ created_at: _createdAt, ...row }) => row);
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
  input: NewRecipient & { isDefault?: boolean },
): Promise<string> {
  const [row] = await db
    .insert(userRecipients)
    .values({
      userId,
      ...toColumns(input),
      isDefault: input.isDefault ?? false,
    })
    .returning({ id: userRecipients.id });

  return row.id;
}

/** Оновлює отримувача; `false` — рядка немає або він належить іншому актору. */
export async function updateRecipient(
  db: ActorDb,
  userId: string,
  id: string,
  input: RecipientInput,
): Promise<boolean> {
  const updated = await db
    .update(userRecipients)
    .set({ ...toColumns(input), isDefault: input.isDefault })
    .where(and(eq(userRecipients.id, id), eq(userRecipients.userId, userId)))
    .returning({ id: userRecipients.id });

  return updated.length > 0;
}

/** Видаляє отримувача; `false` — рядка немає або він чужий. */
export async function deleteRecipient(
  db: ActorDb,
  userId: string,
  id: string,
): Promise<boolean> {
  const deleted = await db
    .delete(userRecipients)
    .where(and(eq(userRecipients.id, id), eq(userRecipients.userId, userId)))
    .returning({ id: userRecipients.id });

  return deleted.length > 0;
}

/** Знімає прапорець «основний» з усіх отримувачів покупця. */
export async function clearDefaultRecipients(
  db: ActorDb,
  userId: string,
): Promise<void> {
  await db
    .update(userRecipients)
    .set({ isDefault: false })
    .where(eq(userRecipients.userId, userId));
}

/** Форма запиту → колонки таблиці (спільна для вставки й оновлення). */
function toColumns(input: NewRecipient) {
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    email: input.email,
    city: input.city,
    address: input.address,
    notes: input.notes,
  };
}
