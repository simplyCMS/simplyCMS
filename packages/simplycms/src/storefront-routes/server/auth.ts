import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { readProfileUiLocale, readSessionSubject } from 'simplycms/auth';

/** Ідентичність, яку ядро віддає роутам і компонентам. */
export interface SessionUser {
  readonly id: string;
  readonly email: string;
  readonly name: string | null;
  readonly isAdmin: boolean;
}

/**
 * Поточний користувач із сесії Better Auth (К1′б) або `null`.
 *
 * 🔴 Повертається ВЛАСНА вузька форма, а не обʼєкт користувача Better Auth:
 * серверна функція серіалізує все, що поверне, і віддає це браузеру. Поля
 * сесії, які вітрині не потрібні, не мають шансу поїхати туди «за компанію».
 */
export const getUser = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SessionUser | null> => {
    const subject = await readSessionSubject(getRequest().headers);
    if (!subject) return null;

    return {
      id: subject.userId,
      email: subject.email,
      name: subject.name,
      isAdmin: subject.roles.includes('admin'),
    };
  },
);

/** Сесія для guard-а адмінки: роль і збережена мова інтерфейсу одним викликом. */
export interface AdminSession {
  readonly isAdmin: boolean;
  /** `profiles.ui_locale` адміна; не-адміну не читається. */
  readonly uiLocale: string | null;
}

/**
 * Сесія для `beforeLoad` `/admin` (§19.6): `null` без сесії; `isAdmin` за ролями; мова
 * адмінки з профілю — тим самим викликом, а не окремим запитом після нього (три послідовні
 * serverFn-и на кожен вхід в адмінку були б три мережеві обміни).
 */
export const getAdminSession = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AdminSession | null> => {
    const subject = await readSessionSubject(getRequest().headers);
    if (!subject) return null;
    const isAdmin = subject.roles.includes('admin');
    return {
      isAdmin,
      uiLocale: isAdmin ? await readProfileUiLocale(subject.userId) : null,
    };
  },
);
