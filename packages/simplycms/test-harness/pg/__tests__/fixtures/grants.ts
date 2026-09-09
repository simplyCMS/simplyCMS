// Очікувана привілейна поверхня baseline v2 (Task 4, план В2-К1а).
//
// 🔴 Це ДЕКЛАРАЦІЯ, а не знятий дамп. Дамп зафіксував би те, що вийшло, і
// мовчки прийняв би будь-яку майбутню зміну після перезняття; декларація
// змушує автора зміни написати намір словами. Тому очікування живе тут як
// типізований TS-модуль, а не як згенерований JSON.
//
// Форма навмисно групова: 45 таблиць плоским списком читати неможливо, а
// група відповідає на питання «чому саме ці права», яке й перевіряє ревʼюер.
// Плаский зріз для порівняння з БД будує `expectedGrantMatrix()`.

/** Команди DML, які розрізняє гейт (решта ACL-прав ролям не видається). */
export type Cmd = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';

const CRUD: Cmd[] = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];

/**
 * Каталог і довідники: `app_user` — читання (вітрину бачить і анонім, він
 * працює під тією ж роллю без GUC), `app_admin` — повний CRUD з адмінки.
 */
const CATALOG = [
  'banners',
  'discount_conditions',
  'discount_groups',
  'discount_targets',
  'discounts',
  'languages',
  'modification_property_values',
  'order_statuses',
  'pickup_points',
  'plugins',
  'price_types',
  'product_modifications',
  'product_prices',
  'product_property_values',
  'products',
  'property_options',
  'section_properties',
  'section_property_assignments',
  'sections',
  'services',
  'shipping_methods',
  'shipping_rates',
  'shipping_zones',
  'stock_by_pickup_point',
  'system_settings',
  'themes',
  'user_categories',
];

/** Доменні таблиці, які покупцю не видно взагалі. */
const ADMIN_ONLY = ['category_rules', 'plugin_events'];

/**
 * Таблиці Better Auth: лише серверний auth-контур (Task 7). Покупець не сміє
 * бачити ні чужі сесії, ні хеші паролів — публічна частина живе в `profiles`.
 */
const AUTH_ONLY = ['users', 'sessions', 'accounts', 'verifications'];

/**
 * Індивідуальні набори. Для RLS-таблиць вони мусять збігатися з обʼєднанням
 * команд політик тієї ж ролі — це окремо асертить `grants-parity.test.ts`.
 */
const INDIVIDUAL: Record<string, { app_user?: Cmd[]; app_admin?: Cmd[] }> = {
  // Повне володіння своїми рядками.
  comparisons: { app_user: CRUD },
  wishlists: { app_user: CRUD },
  product_reviews: { app_user: CRUD, app_admin: CRUD },
  // Адрес і отримувачів адмін лише читає (потрібно для обробки замовлення).
  user_addresses: { app_user: CRUD, app_admin: ['SELECT'] },
  user_recipients: { app_user: CRUD, app_admin: ['SELECT'] },
  // Замовлення покупець не редагує: скасування — серверна операція адміна.
  orders: { app_user: ['SELECT', 'INSERT'], app_admin: CRUD },
  order_items: { app_user: ['SELECT', 'INSERT'], app_admin: CRUD },
  // Профіль створює хук Better Auth під `app_admin`.
  profiles: { app_user: ['SELECT', 'UPDATE'], app_admin: CRUD },
  // Заявку лишає будь-хто, бачить — лише свою.
  service_requests: { app_user: ['SELECT', 'INSERT'], app_admin: CRUD },
  // Роль і історію категорії призначає система, не покупець.
  user_roles: { app_user: ['SELECT'], app_admin: CRUD },
  user_category_history: { app_user: ['SELECT'], app_admin: CRUD },
  // 🔴 Без UPDATE/DELETE у `app_user`: незмінність колонок власності медіа
  // тримається відсутністю права, а не тригером (`schema/media.ts`).
  media: { app_user: ['SELECT', 'INSERT'], app_admin: CRUD },
};

/** Ролі, чиї гранти взагалі очікуються (решта — порушення). */
export const GRANTED_ROLES = ['app_admin', 'app_user'] as const;

/**
 * Плаский очікуваний зріз: `{ table: { role: Cmd[] } }`, команди відсортовані.
 * `app_runtime` тут немає навмисно — вона не має прямих грантів (fail-closed).
 */
export function expectedGrantMatrix(): Record<string, Record<string, Cmd[]>> {
  const matrix: Record<string, Record<string, Cmd[]>> = {};
  const put = (table: string, role: string, cmds: Cmd[]) => {
    matrix[table] ??= {};
    matrix[table][role] = [...cmds].sort();
  };
  for (const table of CATALOG) {
    put(table, 'app_user', ['SELECT']);
    put(table, 'app_admin', CRUD);
  }
  for (const table of [...ADMIN_ONLY, ...AUTH_ONLY])
    put(table, 'app_admin', CRUD);
  for (const [table, roles] of Object.entries(INDIVIDUAL)) {
    if (roles.app_user) put(table, 'app_user', roles.app_user);
    if (roles.app_admin) put(table, 'app_admin', roles.app_admin);
  }
  return matrix;
}
