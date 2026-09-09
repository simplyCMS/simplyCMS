/**
 * SQL-літерали demo-сіду діагностичного стенда (план Р8, Step 3).
 *
 * Чистий модуль: жодного IO і жодного `pg`. Саме він під тестом
 * (`tests/dev-stand-seed.test.ts`) — екранування каталожних текстів із
 * лапками, зворотними слешами й юнікодом має бути доказаним, а не «на око».
 *
 * 🔴 Зворотні слеші НЕ подвоюються свідомо: при `standard_conforming_strings
 * = on` (дефолт Postgres/Supabase) слеш у рядковому літералі — звичайний
 * символ, і подвоєння зіпсувало б дані. Щоб файл не залежав від налаштувань
 * сесії, згенерований сід виставляє цей параметр явно (див. `generate-seed`).
 */

/** Рядковий літерал: одинарні лапки подвоюються, решта — як є. */
export function quote(value) {
  const text = String(value);
  if (text.includes('\u0000')) {
    throw new Error(
      'Значення містить NUL-байт — Postgres такий текст не приймає; ' +
        'почисти дані в джерелі перед дампом',
    );
  }
  return `'${text.replace(/'/g, "''")}'`;
}

/**
 * Значення рядка з `pg` → SQL-літерал.
 *
 * `json: true` (колонка jsonb за allowlist-ом) серіалізує обʼєкт/масив у
 * валідний jsonb-літерал; `null` перевіряється ПЕРШИМ, тож порожня jsonb-
 * колонка лишається `null`, а не рядком `"null"`.
 */
export function toSqlLiteral(value, { json = false } = {}) {
  if (value === null || value === undefined) return 'null';
  if (json) return `${quote(JSON.stringify(value))}::jsonb`;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`Нечислове значення для SQL-літерала: ${value}`);
    }
    return String(value);
  }
  // timestamptz у `pg` приходить обʼєктом Date — фіксуємо в UTC-ISO.
  if (value instanceof Date)
    return `${quote(value.toISOString())}::timestamptz`;
  if (typeof value === 'string') return quote(value);
  throw new Error(
    `Непідтримуваний тип значення для SQL-літерала: ${typeof value}`,
  );
}
