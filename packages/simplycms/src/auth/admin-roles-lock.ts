/**
 * Advisory-ключ ролей адміна (Е6г-4, Е6г-19): його беруть `setAdminRole`,
 * `setCustomerBan`, `deleteCustomer` і invite власника. Перевірки «не адмін»,
 * «не я», «не останній» і «не забанений» виконуються лише під ним.
 *
 * 🔴 Живе в `auth`, а не в `admin-server`: invite (auth) не може імпортувати
 * адмінку, а адмінка імпортує ключ звідси. Порядок локів (канон §13):
 * `customer-category:<userId>` → `admin-roles`, зворотного не бере ніхто.
 */
export const ADMIN_ROLES_LOCK = 'admin-roles';
