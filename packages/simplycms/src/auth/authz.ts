import type { ActorRole } from 'simplycms/db';

/**
 * Перший рубіж моделі безпеки B5″ — типізований authz у TS (Task 7, В2-К1а).
 *
 * 🔴 Рубежів два, і плутати їх не можна. ТУТ вирішується, чи операція взагалі
 * дозволена цьому субʼєкту; РОЛЬ БД (`app_user`/`app_admin`, вмикається
 * `SET LOCAL ROLE` у `withActor`) — другий рубіж, страхувальна сітка проти
 * забутого `WHERE` у репозиторії. Другий рубіж не замінює першого: застосунок
 * сам виставляє собі claims, тож проти скомпрометованого процесу RLS не
 * захищає — це виміряно спайком B5.
 */

/** Доменна роль із `user_roles.role` (енам `app_role`). */
export type AppRole = 'admin' | 'user';

/**
 * Вимір ДІЇ над рядками — дизайн-насіння зі спеки §8.
 *
 * 🔴 Тут навмисно ЛИШЕ місце, а не реалізація: `own` не фільтрує нічого сам —
 * він каже викликачу, що запит зобовʼязаний звузитись до власних рядків
 * (а RLS це продублює). Ролі персоналу (менеджер замовлень, контент-редактор)
 * зʼявляться пізніше й розрізнятимуться саме цим виміром, а не набором
 * операцій, — тому вимір заведено ЗАРАЗ, поки матриця мала.
 */
export type AuthScope = 'own' | 'any';

/** Операції, які знає ядро. Список росте разом із serverFn-шаром К2/К3. */
export type Operation =
  | 'catalog.read'
  | 'catalog.write'
  | 'order.read'
  | 'order.create'
  | 'profile.read'
  | 'profile.update'
  | 'review.create'
  | 'review.moderate'
  | 'user.role.assign'
  | 'admin.access';

/** Хто робить операцію. `userId: null` — анонім (гість вітрини). */
export interface AuthzSubject {
  readonly userId: string | null;
  readonly roles: readonly AppRole[];
}

type Grants = Readonly<Partial<Record<AppRole, AuthScope>>>;

/**
 * Матриця «роль × операція → scope». Відсутній ключ ролі = заборонено.
 *
 * 🔴 Анонім у матриці НЕ фігурує окремим рядком: він не має жодної ролі, тож
 * усе, крім явно публічного, йому закрите за побудовою. Публічне читання
 * каталогу дає не ця матриця, а ГРАНТ на `app_user` (0002_grants.sql) —
 * тримати «дозволено всім» у двох місцях означало б колись розійтись.
 */
export const AUTHZ_MATRIX: Readonly<Record<Operation, Grants>> = {
  'catalog.read': { user: 'any', admin: 'any' },
  'catalog.write': { admin: 'any' },
  'order.read': { user: 'own', admin: 'any' },
  'order.create': { user: 'own', admin: 'any' },
  'profile.read': { user: 'own', admin: 'any' },
  'profile.update': { user: 'own', admin: 'any' },
  'review.create': { user: 'own', admin: 'any' },
  'review.moderate': { admin: 'any' },
  'user.role.assign': { admin: 'any' },
  'admin.access': { admin: 'any' },
};

/** Відмова authz. Окремий клас — щоб хендлер мапив її в 403, а не в 500. */
export class AuthzError extends Error {
  constructor(readonly operation: Operation | AppRole) {
    super(`[simplycms/auth] Операція заборонена: ${operation}.`);
    this.name = 'AuthzError';
  }
}

/** `any` перекриває `own`; порядок потрібен для субʼєкта з кількома ролями. */
const WIDER: Record<AuthScope, number> = { own: 0, any: 1 };

/**
 * Найширший scope, який дають субʼєкту його ролі, або `null` — заборонено.
 */
export function resolveGrant(
  subject: AuthzSubject,
  operation: Operation,
): AuthScope | null {
  const grants = AUTHZ_MATRIX[operation];
  let best: AuthScope | null = null;
  for (const role of subject.roles) {
    const scope = grants[role];
    if (scope && (best === null || WIDER[scope] > WIDER[best])) best = scope;
  }
  return best;
}

/** Чи дозволена операція (без деталей scope). */
export const can = (subject: AuthzSubject, operation: Operation): boolean =>
  resolveGrant(subject, operation) !== null;

/**
 * Вимагає роль. Використовується там, де перевірка — саме про роль
 * (наприклад, вхід в адмінку), а не про конкретну операцію.
 *
 * @throws AuthzError
 */
export function requireRole(
  subject: AuthzSubject,
  role: AppRole,
): asserts subject is AuthzSubject {
  if (!subject.roles.includes(role)) throw new AuthzError(role);
}

/**
 * Вимагає операцію й повертає scope, з яким її дозволено виконати.
 *
 * 🔴 Повертає саме scope, а не `void`: викликач мусить ПОБАЧИТИ, що йому
 * дозволено лише `own`, і звузити запит. Функція, що повертала б `void`,
 * зробила б різницю між `own` і `any` невидимою на місці виклику.
 *
 * @throws AuthzError
 */
export function requireOperation(
  subject: AuthzSubject,
  operation: Operation,
): AuthScope {
  const scope = resolveGrant(subject, operation);
  if (!scope) throw new AuthzError(operation);
  return scope;
}

/**
 * Доменна роль → роль БД для `withActor` (другий рубіж).
 *
 * 🔴 Мапа однобічна й навмисно тупа: `app_admin` вмикається ЛИШЕ після того,
 * як перший рубіж уже сказав «так». Викликати `withActor` з `app_admin`,
 * оминувши `requireOperation`, — це і є той обхід, проти якого весь дизайн.
 */
export const dbRoleFor = (role: AppRole): ActorRole =>
  role === 'admin' ? 'app_admin' : 'app_user';

/** Роль БД для субʼєкта: адмін — якщо він адмін, інакше звичайний покупець. */
export const dbRoleForSubject = (subject: AuthzSubject): ActorRole =>
  subject.roles.includes('admin') ? 'app_admin' : 'app_user';
