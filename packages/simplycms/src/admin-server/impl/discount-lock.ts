/**
 * Advisory-ключ конфігурації знижок (Е6в-15). ПЕРШИЙ запит транзакції
 * (`lockCatalogTarget`) кожного запису груп (insert/update фабрики — guard
 * циклу й пари дат), `saveDiscountOp` і `removeDiscountGroupsOp`: саме він
 * серіалізує перевірку «новий батько не є нащадком» із паралельним
 * перевішуванням і видаленням піддерева.
 *
 * 🔴 Глобальний порядок локів: `customer-config` → `discount-config`
 * (Е6в-15). Операція, якій потрібні обидва (`saveDiscount` з умовою
 * `user_category`), бере `CUSTOMER_CONFIG_LOCK` ПЕРШИМ; навпаки — дедлок
 * із видаленням категорії, що перевіряє посилання з умов знижок.
 */
export const DISCOUNT_CONFIG_LOCK = 'discount-config';
