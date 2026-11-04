import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { AdminNotFoundError } from 'simplycms/contracts/domain-errors';
import { toUiLocale } from 'simplycms/i18n';
import { defineOperation } from 'simplycms/operations';
import { profiles } from 'simplycms/schema';
import type { CoreActor } from 'simplycms/auth';

// Мова інтерфейсу адмінки з профілю (М2а Д7, І45). Обидві операції — лише для
// власного рядка: `userId` береться з актора, а не з входу, тож чужий профіль
// недосяжний за побудовою (RLS `profiles_*_own` додає другий рубіж для ролі user).

/** Власний `userId`; актор `system` профілю не має — відмова, а не мовчазний no-op. */
function ownUserId(actor: CoreActor): string {
  if (actor.kind !== 'admin') throw new AdminNotFoundError('профіль');
  return actor.userId;
}

const uiLocaleField = z
  .string()
  .nullable()
  // Лише код наявного пакета: інакше інтерфейс адмінки зламався б на невідомій мові.
  .refine((value) => value === null || toUiLocale(value) !== null);

const view = z.object({ uiLocale: z.string().nullable() });

export const profilesGetUiLocale = defineOperation({
  id: 'profiles.getUiLocale',
  permission: 'profile.read',
  input: z.object({}),
  output: view,
  async run({ db, actor }) {
    const [row] = await db
      .select({ uiLocale: profiles.uiLocale })
      .from(profiles)
      .where(eq(profiles.userId, ownUserId(actor)))
      .limit(1);
    // Профілю ще немає — це те саме, що «не обрано»: адмінка йде на основну мову.
    return { uiLocale: row?.uiLocale ?? null };
  },
});

export const profilesSetUiLocale = defineOperation({
  id: 'profiles.setUiLocale',
  permission: 'profile.update',
  input: z.object({ uiLocale: uiLocaleField }),
  output: view,
  async run({ db, actor }, input) {
    const userId = ownUserId(actor);
    const updated = await db
      .update(profiles)
      .set({ uiLocale: input.uiLocale, updatedAt: new Date() })
      .where(eq(profiles.userId, userId))
      .returning({ uiLocale: profiles.uiLocale });
    if (updated.length === 0)
      await db
        .insert(profiles)
        .values({ id: crypto.randomUUID(), userId, uiLocale: input.uiLocale });
    return { uiLocale: input.uiLocale };
  },
});
