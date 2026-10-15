/** Спільні хелпери доставки; ключ замка — `LOCK_KEYS.shippingConfig` (реєстр `simplycms/db/lock-keys`). */

/**
 * Guarded remove доставки: кожен запитаний id має знайтись (`found` —
 * рядки, прочитані під локом). Дублікати id рахуються один раз; відсутній
 * id — помилка зі списком відсутніх, яка відкочує ВЕСЬ batch (жодного
 * часткового видалення).
 */
export function assertAllFound(
  entity: string,
  ids: readonly string[],
  found: readonly { id: string }[],
): void {
  if (found.length === new Set(ids).size) return;
  const have = new Set(found.map((r) => r.id));
  const missing = ids.filter((id) => !have.has(id));
  throw new Error(
    `[admin-server] ${entity}: рядків не існує: ${missing.join(', ')}`,
  );
}
