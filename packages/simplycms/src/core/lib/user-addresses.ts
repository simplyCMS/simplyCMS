import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { z } from 'zod';
import { readSessionSubject } from 'simplycms/auth';
import {
  clearDefaultAddresses,
  createAddress,
  deleteAddress,
  loadAddresses,
  updateAddress,
  withCustomerDb,
  type ActorDb,
  type AddressRow,
} from 'simplycms/storefront/loaders';

export type { AddressRow };

/** Поля форми адреси. `id` відсутній — створення, заданий — редагування. */
const addressInput = z.object({
  id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(100),
  city: z.string().min(1).max(100),
  address: z.string().min(1).max(300),
  isDefault: z.boolean(),
});

/**
 * Адреси власника сесії.
 *
 * 🔴 `userId` у схемі входу НЕМАЄ в жодного з трьох викликів цього модуля —
 * він завжди береться з cookie Better Auth. Саме на цьому тримається межа:
 * RLS звіряє рядки з тим id, який їй назвав сервер, тож прийнятий від
 * клієнта id вона перевірити не може за побудовою — вона стане на його бік.
 */
export const getMyAddresses = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AddressRow[]> =>
    withSessionDb((db, userId) => loadAddresses(db, userId)),
);

/**
 * Створити або оновити адресу власника сесії.
 *
 * Повертає `null`, якщо рядок із таким `id` актору не належить: RLS його не
 * віддає, і `returning` лишається порожнім. Мовчазний «успіх» тут був би
 * гіршим за відмову — клієнт вважав би чужу адресу переписаною.
 */
export const saveMyAddress = createServerFn({ method: 'POST' })
  .inputValidator(addressInput)
  .handler(async ({ data }): Promise<string | null> => {
    const input = data as z.infer<typeof addressInput>;

    return withSessionDb(async (db, userId) => {
      // Прапорець «за замовчуванням» — рівно один на покупця, тож решту
      // знімаємо в ТІЙ САМІЙ транзакції: два окремі запити лишали б вікно,
      // у якому дефолтних адрес дві.
      if (input.isDefault) await clearDefaultAddresses(db, userId);

      if (!input.id) return createAddress(db, userId, input);
      const ok = await updateAddress(db, userId, input.id, input);
      return ok ? input.id : null;
    });
  });

/** Видалити власну адресу; `false` — рядка немає або він чужий. */
export const deleteMyAddress = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }): Promise<boolean> => {
    const { id } = data as { id: string };
    return withSessionDb((db, userId) => deleteAddress(db, userId, id));
  });

/**
 * Транзакція від імені власника сесії.
 *
 * 🔴 Дублює `storefront/loaders/session#withSessionDb` свідомо:
 * тір-зони забороняють `core` (T5) імпортувати `storefront-routes` (T5), а
 * прорізати заради цього дірку в напрямку шарів дорожче, ніж повторити
 * шість рядків (той самий компроміс, що в `./auth-session`).
 *
 * 🔴 Функція НЕ експортується: живий не-serverFn експорт утримав би
 * `simplycms/auth` і пул Postgres у клієнтському бандлі.
 */
async function withSessionDb<T>(
  fn: (db: ActorDb, userId: string) => Promise<T>,
): Promise<T> {
  const subject = await readSessionSubject(getRequest().headers);
  if (!subject) {
    // Англійською свідомо: серверна діагностика, а не рядок інтерфейсу.
    throw new Error(
      '[simplycms] Sign-in required: no session for this request.',
    );
  }
  return withCustomerDb(subject.userId, (db) => fn(db, subject.userId));
}
