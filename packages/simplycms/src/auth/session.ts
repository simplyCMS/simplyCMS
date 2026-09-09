import { eq } from 'drizzle-orm';
import { withActor } from 'simplycms/db';
import { userRoles } from 'simplycms/schema';
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
