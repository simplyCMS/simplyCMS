import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { AdminNotFoundError } from 'simplycms/contracts/domain-errors';
import { toUiLocale } from 'simplycms/i18n';
import { defineOperation } from 'simplycms/operations';
import { profiles } from 'simplycms/schema';
import type { CoreActor } from 'simplycms/auth';

// Мова інтерфейсу адмінки в профілі (М2а Д7, І45). Лише власний рядок: `userId` береться з
// актора, а не з входу, тож чужий профіль недосяжний за побудовою. Для ролі user запис
// дозволяє колонковий грант `ui_locale` (0002_grants) і RLS `profiles_update_own`.
// Читання мови — не операція: `beforeLoad` `/admin` бере її разом із сесією (§19.6).

/** Власний `userId`; актор `system` профілю не має — відмова, а не мовчазний no-op. */
function ownUserId(actor: CoreActor): string {
  if (actor.kind !== 'admin') throw new AdminNotFoundError('профіль');
  return actor.userId;
}

const uiLocaleField = z
  .string()
  .nullable()
  // Лише код пакета З ЧАСТИНОЮ `admin` (§19.15): інакше адмінка зламалась би на мові без
  // адмінських рядків. Інший код — 400.
  .refine((value) => value === null || toUiLocale(value, ['admin']) !== null);

export const profilesSetUiLocale = defineOperation({
  id: 'profiles.setUiLocale',
  permission: 'profile.update',
  input: z.object({ uiLocale: uiLocaleField }),
  output: z.object({ uiLocale: z.string().nullable() }),
  async run({ db, actor }, input) {
    const updated = await db
      .update(profiles)
      .set({ uiLocale: input.uiLocale, updatedAt: new Date() })
      .where(eq(profiles.userId, ownUserId(actor)))
      .returning({ id: profiles.id });
    // Профіль створює провізія при появі користувача (`provisionUserInDb`) — дефолти (пошта,
    // категорія) живуть там єдиною копією. Його відсутність — дефект даних, а не привід
    // створювати рядок тут: мовчазний no-op збрехав би, що вибір збережено.
    if (updated.length === 0) throw new AdminNotFoundError('профіль');
    return { uiLocale: input.uiLocale };
  },
});
