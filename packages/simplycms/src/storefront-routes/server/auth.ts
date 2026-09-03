import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { readSessionSubject } from 'simplycms/auth';
import { checkIsAdmin } from 'simplycms/storefront/loaders';

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

/**
 * Перевірити чи поточний користувач має роль admin (serverFn для роутів/компонентів).
 *
 * 🔴 Сама перевірка живе в `./is-admin` і навмисно НЕ реекспортується звідси:
 * цей модуль клієнтські роути імпортують заради `getUser`, і будь-який живий
 * не-serverFn експорт тут затягнув би серверний auth-контур (а з ним пул
 * Postgres) у клієнтський бандл — див. коментар у `is-admin.ts`.
 */
export const isAdmin = createServerFn({ method: 'GET' }).handler(async () =>
  checkIsAdmin(),
);
