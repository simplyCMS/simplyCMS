// Фікстурні актори й мінімальні дані для поведінкового гейта RLS
// (Task 5, план В2-К1а).
//
// 🔴 Це НЕ сід магазину (`0003_seed.sql`) — власні рядки тесту. Сід описує
// чистий магазин і мусить лишатись мінімальним; матриця ж потребує рівно
// протилежного — двох користувачів із перехресними рядками, гостьового
// замовлення з токеном і медіа з чужим власником. Змішування двох наборів
// зробило б і сід брехливим, і матрицю крихкою.
//
// Рядки заводить ВЛАСНИК таблиць, а не актор: власник за побудовою поза RLS
// (`FORCE ROW LEVEL SECURITY` баз не вмикає), тож підготовка даних не залежить
// від того, що саме доводить тест. Історично рівно ця властивість і робила
// забутий `SET LOCAL ROLE` тихим — негативний контроль №1 фіксує, що тепер ні.

export const USER_A = '11111111-1111-4111-8111-111111111111';
export const USER_B = '22222222-2222-4222-8222-222222222222';
export const USER_ADMIN = '33333333-3333-4333-8333-333333333333';
export const PRODUCT = '44444444-4444-4444-8444-444444444444';
export const ORDER_A = '55555555-5555-4555-8555-555555555555';
export const ORDER_GUEST = '66666666-6666-4666-8666-666666666666';
export const MEDIA_A = '77777777-7777-4777-8777-777777777777';
export const SERVICE = '88888888-8888-4888-8888-888888888888';

/**
 * Категорія `retail` із `0003_seed.sql` — єдина в чистому магазині.
 *
 * 🔴 Підзапит, а НЕ хардкод uuid: сід створює рядок через `gen_random_uuid()`,
 * тож ідентифікатор різний у кожній свіжій БД харнеса. Береться саме з сіду
 * (а не заводиться тут власна категорія), бо `user_category_history
 * .to_category_id` має FK — власна категорія приховала б регрес, якби сід
 * колись перестав засівати `retail`.
 */
const SEED_CATEGORY = `(select id from public.user_categories where code = 'retail')`;

/** Токен гостьового замовлення — заміна edge-функції `get-guest-order`. */
export const GUEST_TOKEN = 'guest-token-9f3c4a';

const ORDER_COLUMNS =
  'id, user_id, order_number, first_name, last_name, email, phone, ' +
  'payment_method, subtotal, total, access_token';

/** SQL підготовки даних; котиться під власником таблиць, по стейтменту. */
export const SEED_STATEMENTS: string[] = [
  `insert into public.users (id, name, email) values
     ('${USER_A}', 'Актор A', 'a@example.test'),
     ('${USER_B}', 'Актор B', 'b@example.test'),
     ('${USER_ADMIN}', 'Адміністратор', 'admin@example.test')`,
  `insert into public.products (id, slug, name)
     values ('${PRODUCT}', 'test-product', 'Тестовий товар')`,
  `insert into public.profiles (user_id, email) values
     ('${USER_A}', 'a@example.test'), ('${USER_B}', 'b@example.test')`,
  `insert into public.wishlists (user_id, product_id) values
     ('${USER_A}', '${PRODUCT}'), ('${USER_B}', '${PRODUCT}')`,
  `insert into public.user_addresses (user_id, name, city, address) values
     ('${USER_A}', 'Дім A', 'Київ', 'вул. Перша, 1'),
     ('${USER_B}', 'Дім B', 'Львів', 'вул. Друга, 2')`,
  `insert into public.orders (${ORDER_COLUMNS}) values
     ('${ORDER_A}', '${USER_A}', 'A-0001', 'Андрій', 'Актор',
      'a@example.test', '+380000000001', 'card', 100, 100, null)`,
  // Гостьове замовлення: `user_id` порожній, доступ — лише за токеном.
  `insert into public.orders (${ORDER_COLUMNS}) values
     ('${ORDER_GUEST}', null, 'G-0001', 'Гість', 'Гостьов',
      'g@example.test', '+380000000009', 'card', 50, 50, '${GUEST_TOKEN}')`,
  `insert into public.order_items (order_id, product_id, name, price, quantity, total) values
     ('${ORDER_A}', '${PRODUCT}', 'Тестовий товар', 100, 1, 100),
     ('${ORDER_GUEST}', '${PRODUCT}', 'Тестовий товар', 50, 1, 50)`,
  `insert into public.media
     (id, entity_type, entity_id, storage_key, size_bytes, mime_type, uploaded_by)
     values ('${MEDIA_A}', 'product', '${PRODUCT}', 'products/a.webp',
             1024, 'image/webp', '${USER_A}')`,
  // Схвалений відгук B видно всім; чернетка A — лише самому A.
  `insert into public.product_reviews (product_id, user_id, rating, status) values
     ('${PRODUCT}', '${USER_B}', 5, 'approved'),
     ('${PRODUCT}', '${USER_A}', 4, 'pending')`,
  // 🔴 Нижче — перехресні рядки для решти RLS-таблиць. Додано 2026-08-23 після
  // знахідки рев'ю (лінза test-honesty, борг К1а-9): матриця екзаменувала лише
  // частину захищених таблиць, і підміна предиката `user_roles_select_own` на
  // `true` лишала ВЕСЬ гейт зеленим. Структурна перевірка (ACL + текст
  // предиката) поведінку не доводить — кожна захищена таблиця мусить мати
  // рядки двох різних власників, інакше «зелено» означає лише «порожньо».
  `insert into public.comparisons (user_id, product_id) values
     ('${USER_A}', '${PRODUCT}'), ('${USER_B}', '${PRODUCT}')`,
  `insert into public.services (id, slug, name)
     values ('${SERVICE}', 'test-service', 'Тестова послуга')`,
  `insert into public.service_requests (service_id, user_id, name, email) values
     ('${SERVICE}', '${USER_A}', 'Заявка A', 'a@example.test'),
     ('${SERVICE}', '${USER_B}', 'Заявка B', 'b@example.test')`,
  // `::uuid` обовʼязковий: у формі `select … union all select …` Postgres
  // виводить тип із літерала (text), а не з цільової колонки, як у `values`.
  `insert into public.user_category_history (user_id, to_category_id)
     select '${USER_A}'::uuid, ${SEED_CATEGORY}
     union all
     select '${USER_B}'::uuid, ${SEED_CATEGORY}`,
  // Ролі: A і B — звичайні користувачі, ADMIN — адмін. Саме цей рядок робить
  // видимою суть `user_roles`: побачити чужу роль означає дізнатись, хто адмін.
  `insert into public.user_roles (user_id, role) values
     ('${USER_A}', 'user'), ('${USER_B}', 'user'), ('${USER_ADMIN}', 'admin')`,
];

/** Скільки рядків таблиці актор реально бачить (`::int` — щоб не рядок). */
export const countSql = (table: string, where?: string): string =>
  `select count(*)::int as n from public.${table}` +
  (where ? ` where ${where}` : '');

/** Отримувач — таблиця без фікстурних рядків, тож пара «свій/чужий» чиста. */
export const recipientInsert = (userId: string): string =>
  `insert into public.user_recipients
     (user_id, first_name, last_name, phone, city, address)
   values ('${userId}', 'Отримувач', 'Тестовий', '+380000000002',
           'Київ', 'вул. Третя, 3')`;

/** Колонки власності медіа, чия незмінність — інваріант storage-порту К4. */
export const MEDIA_OWNERSHIP_COLUMNS = [
  'entity_type',
  'entity_id',
  'storage_key',
  'uploaded_by',
];

/** Спроба перепривʼязати чужий файл до себе — по одній колонці власності. */
export const mediaRebindSql = (column: string): string =>
  `update public.media set ${column} = ` +
  `${column === 'entity_type' ? `'section'` : `'${USER_B}'`} ` +
  `where id = '${MEDIA_A}'`;

/** Завантаження нового файлу — дозволена операція покупця (SELECT+INSERT). */
export const MEDIA_INSERT = `insert into public.media
   (entity_type, entity_id, storage_key, size_bytes, mime_type, uploaded_by)
 values ('product', '${PRODUCT}', 'products/new.webp', 10, 'image/webp',
         '${USER_A}')`;
