// Пошук «сиріт» (К3-Е6г): рядки, де посилання на `users(id)` вказує в нікуди.
// Спільний для `user-graph` і харнесу видалення акаунта.
import { expect } from 'vitest';

type Query = (sql: string) => Promise<unknown[]>;

/** `таблиця.колонка → кількість сиріт`; порожній обʼєкт — сиріт немає. */
export async function findOrphans(q: Query): Promise<Record<string, number>> {
  const cols = (await q(
    `select table_name, column_name from information_schema.columns
      where table_schema = 'public'
        and column_name in ('user_id', 'changed_by', 'uploaded_by')`,
  )) as { table_name: string; column_name: string }[];
  expect(cols.length).toBeGreaterThan(10);
  const result: Record<string, number> = {};
  for (const { table_name: t, column_name: c } of cols) {
    const n = (
      (await q(
        `select count(*)::int n from public."${t}" x
          where x."${c}" is not null
            and not exists (select 1 from public.users u where u.id = x."${c}")`,
      )) as { n: number }[]
    )[0]!.n;
    if (n > 0) result[`${t}.${c}`] = n;
  }
  return result;
}
