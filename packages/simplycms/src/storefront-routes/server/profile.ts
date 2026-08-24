import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import {
  loadProfile,
  loadUserOrders,
  updateProfile,
  type OrderListRow,
  type ProfileRow,
} from 'simplycms/storefront/loaders';
import { withSessionDb } from './session-db';

/** Скільки останніх замовлень показує головна сторінка кабінету. */
const RECENT_ORDERS = 3;

/** Дані головної сторінки кабінету — однією транзакцією актора. */
export interface ProfileOverview {
  profile: ProfileRow | null;
  recentOrders: OrderListRow[];
}

/** Профіль і останні замовлення власника сесії. */
export const getProfileOverview = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ProfileOverview> =>
    withSessionDb(async (db, userId) => ({
      profile: await loadProfile(db, userId),
      recentOrders: (await loadUserOrders(db, userId)).slice(0, RECENT_ORDERS),
    })),
);

/** Профіль для форми налаштувань. */
export const getProfileSettings = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ProfileRow | null> =>
    withSessionDb((db, userId) => loadProfile(db, userId)),
);

/**
 * Зберегти особисті поля профілю.
 *
 * 🔴 `userId` у схемі входу НЕМАЄ навмисно: єдиний рядок, який цей виклик
 * сміє змінити, визначається сесією. Приймати id від клієнта означало б
 * дати будь-кому переписати чужий профіль.
 */
export const saveProfileSettings = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      firstName: z.string().min(2).max(100),
      lastName: z.string().min(2).max(100),
      phone: z.string().max(20).nullable(),
    }),
  )
  .handler(async ({ data: input }): Promise<void> => {
    const update = input as {
      firstName: string;
      lastName: string;
      phone: string | null;
    };
    await withSessionDb((db, userId) => updateProfile(db, userId, update));
  });
