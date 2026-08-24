import type { AppRole } from './authz';

/**
 * Порт `handle_new_user` у TS (B3′, Task 7) — те, що робив SQL-тригер
 * `on_auth_user_created` на схемі GoTrue.
 *
 * 🔴 Інваріант `first_user_no_auto_admin` (аудит 2026-08-04) переїхав сюди
 * РАЗОМ із логікою і мусить лишитись: перший signup НЕ стає адміном. Стара
 * діра звалась «хто перший встиг» — реєстрація на свіжому магазині давала
 * повний доступ будь-кому, хто випередив власника. Роль `admin` тепер видає
 * ЛИШЕ invite власника (`./invite`) або наявний адмін. Тут ролі не
 * обчислюються взагалі — вона константа, і саме тому діру неможливо
 * відтворити «випадковою умовою».
 */

/** Роль КОЖНОГО новоствореного користувача. Винятків немає — див. вище. */
export const SIGNUP_ROLE: AppRole = 'user';

/** Мінімум, який Better Auth знає про щойно створеного користувача. */
export interface NewAuthUser {
  readonly id: string;
  readonly email: string;
  readonly name?: string | null;
}

/** Що саме треба записати в доменні таблиці магазину. */
export interface UserProvisionPlan {
  readonly userId: string;
  readonly email: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly role: AppRole;
}

/** Запис плану в БД. Порт — щоб хук тестувався без Postgres. */
export type ProvisionUser = (plan: UserProvisionPlan) => Promise<void>;

/**
 * Розбиває єдине `name` Better Auth на пару, яку чекає `profiles`.
 *
 * 🔴 Розрив моделей реальний: GoTrue тримав `first_name`/`last_name` у
 * `raw_user_meta_data`, а BA має одне поле `name`. Розбиття по ПЕРШОМУ
 * пробілу (решта — у прізвище) — свідомий компроміс: воно не «правильне» для
 * всіх культур, зате зворотне (склеювання) завжди дає вихідний рядок.
 */
export function splitName(name?: string | null): {
  firstName: string | null;
  lastName: string | null;
} {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return { firstName: null, lastName: null };

  const space = trimmed.indexOf(' ');
  if (space === -1) return { firstName: trimmed, lastName: null };
  return {
    firstName: trimmed.slice(0, space),
    lastName: trimmed.slice(space + 1).trim() || null,
  };
}

/**
 * ЧИСТА побудова плану провізії — рівно те, що можна довести юнітом без БД.
 *
 * Категорія покупця тут не обчислюється: у `profiles.category_id` їде
 * категорія за замовчуванням (`user_categories.is_default`, сід `0003_seed`),
 * і вибирає її сам INSERT підзапитом — інакше довелось би тягнути зайве
 * читання й вирішувати, що робити з гонкою.
 */
export function buildUserProvision(user: NewAuthUser): UserProvisionPlan {
  const { firstName, lastName } = splitName(user.name);
  return {
    userId: user.id,
    email: user.email,
    firstName,
    lastName,
    role: SIGNUP_ROLE,
  };
}

/**
 * `databaseHooks.user.create.after` для інстансу Better Auth.
 *
 * 🔴 Хук виконується ПІСЛЯ коміту створення користувача й окремою
 * транзакцією, тобто атомарності «user + profile» немає. Це властивість
 * `databaseHooks`, а не недогляд: єдиний спосіб дістати атомарність — вести
 * весь signUp однією транзакцією, чого адаптер BA не дає. Наслідок треба
 * знати: користувач без профілю можливий, якщо провізія впала, — і саме тому
 * помилка звідси НЕ ковтається, а летить наверх, роблячи signUp невдалим.
 */
export const createUserCreateHook =
  (provisionUser: ProvisionUser) =>
  async (user: NewAuthUser): Promise<void> => {
    await provisionUser(buildUserProvision(user));
  };
