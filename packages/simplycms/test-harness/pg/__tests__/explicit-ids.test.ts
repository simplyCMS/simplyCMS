import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = resolve(import.meta.dirname, '../../../src');

/** Серверні вставки в таблиці Категорії A. Файл → drizzle-таблиця. */
const CATEGORY_A_INSERTS = [
  ['storefront/loaders/order-create.ts', 'orders'],
  ['storefront/loaders/order-create.ts', 'orderItems'],
  ['storefront/loaders/reviews-write.ts', 'productReviews'],
  ['storefront/loaders/addresses.ts', 'userAddresses'],
  ['storefront/loaders/recipients.ts', 'userRecipients'],
  ['auth/provision.ts', 'profiles'],
  ['auth/provision.ts', 'userRoles'],
  ['auth/invite-store.ts', 'userRoles'],
  ['themes/server/registry-db.ts', 'themes'],
  ['plugins/server/registry-db.ts', 'plugins'],
] as const;

/**
 * Вирізає текст аргументу першого `.values(` після `.insert(<table>)`,
 * рахуючи дужки. Без цього скан ловить `.returning({ id: … })` і
 * `return { id: row.id }`, тобто дає хибне проходження (знахідка аудиту).
 */
function valuesArgument(src: string, table: string): string | null {
  const insertAt = src.indexOf(`.insert(${table})`);
  if (insertAt < 0) return null;
  const valuesAt = src.indexOf('.values(', insertAt);
  if (valuesAt < 0) return null;

  let depth = 0;
  const from = valuesAt + '.values('.length - 1;
  for (let i = from; i < src.length; i += 1) {
    if (src[i] === '(') depth += 1;
    else if (src[i] === ')') {
      depth -= 1;
      if (depth === 0) return src.slice(from + 1, i);
    }
  }
  return null;
}

describe('Е0: серверні вставки передають id явно', () => {
  it.each(CATEGORY_A_INSERTS)('%s → %s', (file, table) => {
    const src = readFileSync(resolve(SRC, file), 'utf8');
    const values = valuesArgument(src, table);
    expect(
      values,
      `не знайдено .insert(${table}).values(...) у ${file}`,
    ).not.toBeNull();
    expect(
      values!,
      `.insert(${table}) у ${file} не передає id у values(...)`,
    ).toMatch(/(^|[\s{,])id:\s*\S/);
  });
});

describe('Е0: Категорія B id НЕ передає', () => {
  it.each([
    ['auth/invite-store.ts', 'users'],
    ['auth/invite-store.ts', 'verifications'],
  ] as const)('%s → %s лишається на DEFAULT', (file, table) => {
    const src = readFileSync(resolve(SRC, file), 'utf8');
    const values = valuesArgument(src, table);
    if (values === null) return; // вставки може не бути — це не помилка
    expect(
      values,
      `${table} — Категорія B: id генерує БД, Better Auth його не шле`,
    ).not.toMatch(/(^|[\s{,])id:\s*\S/);
  });
});
