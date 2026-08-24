import { and, count, desc, eq } from 'drizzle-orm';
import { orders, userAddresses } from 'simplycms/schema';
import type { ActorDb } from './db';

/** Адреса покупця разом із лічильником замовлень, які на неї послались. */
export interface AddressRow {
  id: string;
  name: string;
  city: string;
  address: string;
  is_default: boolean;
  usage_count: number;
}

/** Поля адреси, які редагує покупець. */
export interface AddressInput {
  name: string;
  city: string;
  address: string;
  isDefault: boolean;
}

/**
 * Адреси покупця з лічильником використань.
 *
 * 🔴 Раніше це був водоспад: браузер брав список, а потім на КОЖНУ адресу
 * робив окремий `count` по замовленнях — N+1 запитів, і кожен із `user_id`
 * із клієнта. Тут один `left join … group by` в транзакції актора.
 *
 * 🔴 `orders` у джойні звужена політикою `orders_select_own_or_token`, тож
 * лічильник рахує ЛИШЕ власні замовлення покупця — чужі до нього не
 * дотягуються навіть якби посилались на цю адресу.
 */
export async function loadAddresses(
  db: ActorDb,
  userId: string,
): Promise<AddressRow[]> {
  const rows = await db
    .select({
      id: userAddresses.id,
      name: userAddresses.name,
      city: userAddresses.city,
      address: userAddresses.address,
      is_default: userAddresses.isDefault,
      created_at: userAddresses.createdAt,
      usage_count: count(orders.id),
    })
    .from(userAddresses)
    .leftJoin(orders, eq(orders.savedAddressId, userAddresses.id))
    .where(eq(userAddresses.userId, userId))
    .groupBy(userAddresses.id)
    .orderBy(desc(userAddresses.isDefault), desc(userAddresses.createdAt));

  return rows.map(({ created_at: _createdAt, ...row }) => row);
}

/**
 * Додає адресу покупцю. `userId` ставить сервер — політика
 * `user_addresses_own_all` має WITH CHECK на власника.
 */
export async function createAddress(
  db: ActorDb,
  userId: string,
  input: AddressInput,
): Promise<string> {
  const [row] = await db
    .insert(userAddresses)
    .values({
      userId,
      name: input.name,
      city: input.city,
      address: input.address,
      isDefault: input.isDefault,
    })
    .returning({ id: userAddresses.id });

  return row.id;
}

/**
 * Оновлює адресу покупця. Повертає `false`, якщо рядок не належить актору.
 *
 * 🔴 Предикат `user_id` тут — ДРУГИЙ рубіж, не єдиний: RLS уже звузила
 * таблицю до власника. Але саме `returning` перетворює «нічого не оновилось»
 * на явну відповідь виклику — без нього спроба переписати чужу адресу
 * виглядала б для клієнта успіхом.
 */
export async function updateAddress(
  db: ActorDb,
  userId: string,
  id: string,
  input: AddressInput,
): Promise<boolean> {
  const updated = await db
    .update(userAddresses)
    .set({
      name: input.name,
      city: input.city,
      address: input.address,
      isDefault: input.isDefault,
    })
    .where(and(eq(userAddresses.id, id), eq(userAddresses.userId, userId)))
    .returning({ id: userAddresses.id });

  return updated.length > 0;
}

/** Видаляє адресу покупця; `false` — рядка немає або він чужий. */
export async function deleteAddress(
  db: ActorDb,
  userId: string,
  id: string,
): Promise<boolean> {
  const deleted = await db
    .delete(userAddresses)
    .where(and(eq(userAddresses.id, id), eq(userAddresses.userId, userId)))
    .returning({ id: userAddresses.id });

  return deleted.length > 0;
}

/** Знімає прапорець «за замовчуванням» з усіх адрес покупця. */
export async function clearDefaultAddresses(
  db: ActorDb,
  userId: string,
): Promise<void> {
  await db
    .update(userAddresses)
    .set({ isDefault: false })
    .where(eq(userAddresses.userId, userId));
}
