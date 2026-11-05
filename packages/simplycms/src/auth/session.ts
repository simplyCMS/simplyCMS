import { eq } from 'drizzle-orm';
import { withActor } from 'simplycms/db';
import { profiles, userRoles } from 'simplycms/schema';
import type { AppRole, AuthzSubject } from './authz';
import { getAuth } from './instance';

/**
 * Ідентичність запиту для серверного контуру (К1′б).
 *
 * 🔴 Тут зшиваються дві половини, які до цього жили окремо: сесію дає Better
 * Auth, а доменні ролі — таблиця `user_roles`. Ролі НЕ кладуться в сесійний
 * токен свідомо: відкликана роль мусить діяти з наступного ж запиту, а не
 * після протермінування cookie.
 */

/** Субʼєкт authz із даними, які потрібні UI (пошта, імʼя). */
export interface SessionSubject extends AuthzSubject {
  readonly userId: string;
  readonly email: string;
  readonly name: string | null;
}

/**
 * Ролі користувача з `user_roles`.
 *
 * 🔴 Актор — `app_user` із його ж `userId`, а не `app_admin`. Політика
 * `user_roles_select_own` віддає під нею рівно рядки цього користувача, тож
 * питання «які в мене ролі» не потребує підвищених прав: перевіряти невідоме
 * правами адміна означало б відповідати на нього ще до того, як він заданий.
 */
export async function readUserRoles(userId: string): Promise<AppRole[]> {
  return withActor({ role: 'app_user', userId }, async (db) => {
    const rows = await db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, userId));

    return rows.map((row) => row.role);
  });
}

/**
 * Мова інтерфейсу адмінки з власного профілю (`profiles.ui_locale`, §19.6) або `null`.
 * Актор той самий, що в `readUserRoles`: політика `profiles_select_own` віддає лише рядок
 * цього користувача. Профілю чи значення немає — `null`: адмінка піде на основну мову.
 */
export async function readProfileUiLocale(
  userId: string,
): Promise<string | null> {
  return withActor({ role: 'app_user', userId }, async (db) => {
    const [row] = await db
      .select({ uiLocale: profiles.uiLocale })
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);
    return row?.uiLocale ?? null;
  });
}

/**
 * Сесія Better Auth із заголовків запиту → субʼєкт authz.
 *
 * Без cookie або з протермінованою сесією повертає `null` — викликач сам
 * вирішує, що це означає (редірект, 401 чи анонімний перегляд).
 */
export async function readSessionSubject(
  headers: Headers,
): Promise<SessionSubject | null> {
  const session = await getAuth().api.getSession({ headers });
  if (!session) return null;

  const { user } = session;
  return {
    userId: user.id,
    email: user.email,
    name: user.name || null,
    roles: await readUserRoles(user.id),
  };
}

/** Чи має власник цієї сесії роль `admin`. Без сесії — `false`. */
export async function isAdminRequest(headers: Headers): Promise<boolean> {
  const subject = await readSessionSubject(headers);
  return subject?.roles.includes('admin') ?? false;
}
