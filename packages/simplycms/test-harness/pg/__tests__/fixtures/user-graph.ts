// Сід тесту графа користувача: покупець з усіма залежними рядками (Е6г).

export const BUYER = 'b1000000-0000-4000-8000-000000000001';
export const OTHER = 'b1000000-0000-4000-8000-000000000002';
export const ADMIN = 'b1000000-0000-4000-8000-000000000003';
const PRODUCT = 'b2000000-0000-4000-8000-000000000001';
const ADDRESS = 'b3000000-0000-4000-8000-000000000001';
export const ORDER_ERASED = 'b4000000-0000-4000-8000-000000000001';
export const ORDER_LIVE = 'b4000000-0000-4000-8000-000000000002';
export const MEDIA = 'b5000000-0000-4000-8000-000000000001';

const CATEGORY = `(select id from public.user_categories where code = 'retail')`;
const CATEGORY_NAME = `(select name from public.user_categories where code = 'retail')`;

export const SEED = [
  `insert into public.users (id, name, email) values
     ('${BUYER}', 'Покупець', 'buyer@example.test'),
     ('${OTHER}', 'Інший', 'other@example.test'),
     ('${ADMIN}', 'Адмін', 'admin@example.test')`,
  `insert into public.products (id, slug, name) values ('${PRODUCT}', 'p', 'Товар')`,
  `insert into public.user_addresses (id, user_id, name, city, address)
     values ('${ADDRESS}', '${BUYER}', 'Дім', 'Київ', 'вул. Перша, 1')`,
  `insert into public.user_recipients (id, user_id, first_name, last_name, phone, city, address)
     values (gen_random_uuid(), '${BUYER}', 'О', 'Т', '+380000000002', 'Київ', 'вул. 3')`,
  // Свій рядок покупця + рядок ІНШОГО покупця, де покупець — `changed_by`.
  `insert into public.user_category_history (id, user_id, changed_by, to_category_id, to_category_name)
     values (gen_random_uuid(), '${BUYER}', null, ${CATEGORY}, ${CATEGORY_NAME}),
            (gen_random_uuid(), '${OTHER}', '${BUYER}', ${CATEGORY}, ${CATEGORY_NAME})`,
  `insert into public.product_reviews (id, product_id, user_id, rating, status)
     values (gen_random_uuid(), '${PRODUCT}', '${BUYER}', 5, 'approved')`,
  `insert into public.wishlists (id, user_id, product_id)
     values (gen_random_uuid(), '${BUYER}', '${PRODUCT}')`,
  `insert into public.comparisons (id, user_id, product_id)
     values (gen_random_uuid(), '${BUYER}', '${PRODUCT}')`,
  `insert into public.media (id, entity_type, entity_id, storage_key, size_bytes, mime_type, uploaded_by)
     values ('${MEDIA}', 'product', '${PRODUCT}', 'k/a.webp', 1, 'image/webp', '${BUYER}')`,
  // Замовлення зі стертими ПД (CHECK пускає це лише з personal_data_erased_at).
  `insert into public.orders (id, user_id, order_number, payment_method, subtotal, total,
                              saved_address_id, personal_data_erased_at)
     values ('${ORDER_ERASED}', '${BUYER}', 'E-1', 'cash', 1, 1, '${ADDRESS}', now())`,
  `insert into public.orders (id, user_id, order_number, first_name, last_name, email, phone,
                              payment_method, subtotal, total)
     values ('${ORDER_LIVE}', '${BUYER}', 'E-2', 'Ім', 'Пр', 'b@example.test', '+38', 'cash', 1, 1)`,
];
