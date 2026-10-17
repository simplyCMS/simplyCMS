/**
 * SQL-фрагменти адреси товару для живого прогону (М1, Task 16): колонок `products.slug`/`name`
 * вже не читаємо — вони тимчасове дзеркало, яке зносить Task 17. Поточна адреса й назва —
 * з реєстру `url_paths` та `product_translations` ОСНОВНОЇ мови (скрипти працюють з нею:
 * вітрина без префікса мови, як і в усіх кроках прогону).
 */

/** Код основної мови магазину — скалярний підзапит. */
export const PRIMARY_LOCALE = `(select code from public.languages where is_default)`;

/** Підзапит `id` товару за його ПОТОЧНОЮ адресою основної мови; `param` — `$1`, `$3` тощо. */
export const productIdByPath = (param) =>
  `(select product_id from public.url_paths
     where is_current and locale = ${PRIMARY_LOCALE} and path = ${param})`;

/**
 * `join` реєстру адрес: поточна адреса основної мови як `<alias>.path`. `left`-варіант —
 * для рядків, що можуть не мати товару (позиція замовлення без `product_id`).
 */
export const joinPrimaryPath = ({
  product = 'p',
  alias = 'up',
  left = false,
} = {}) =>
  `${left ? 'left ' : ''}join public.url_paths ${alias}
     on ${alias}.product_id = ${product}.id and ${alias}.is_current
    and ${alias}.locale = ${PRIMARY_LOCALE}`;
