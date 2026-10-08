/**
 * Агрегати для кроку покупців К3-Е6г: цифри дашборду «з нуля» і сироти.
 */
import { sql } from './sql.mjs';

const one = async (...args) => (await sql(...args))[0] ?? null;

/** Цифри дашборду «з нуля» тим самим SQL, що й `dashboardSummary` (Е6г-12). */
export const dashboardFacts = async (url) => ({
  ...(await one(
    url,
    `select count(*) filter (where o.status_id = n.id)::int as new_orders,
            round(coalesce(sum(o.total) filter (where o.created_at >= now() - interval '7 days'
              and s.code is distinct from 'cancelled'), 0) * 100)::float8 as r7,
            round(coalesce(sum(o.total) filter (where o.created_at >= now() - interval '30 days'
              and s.code is distinct from 'cancelled'), 0) * 100)::float8 as r30,
            n.id as new_status_id
       from public.orders o
       left join public.order_statuses s on s.id = o.status_id
       cross join (select id from public.order_statuses where code = 'new') n
      group by n.id`,
  )),
  latest: (
    await sql(
      url,
      'select order_number from public.orders order by created_at desc, id desc limit 10',
    )
  ).map((r) => r.order_number),
});

/** Сироти: посилання на `users(id)` у нікуди (той самий запит, що `findOrphans` харнеса). */
export async function orphans(url) {
  const cols = await sql(
    url,
    `select table_name, column_name from information_schema.columns
      where table_schema = 'public'
        and column_name in ('user_id', 'changed_by', 'uploaded_by')`,
  );
  const found = {};
  for (const { table_name: t, column_name: c } of cols) {
    const { n } = await one(
      url,
      `select count(*)::int n from public."${t}" x where x."${c}" is not null
         and not exists (select 1 from public.users u where u.id = x."${c}")`,
    );
    if (n > 0) found[`${t}.${c}`] = n;
  }
  return found;
}

export const existsRows = async (url, table, col, id) =>
  (
    await one(
      url,
      `select count(*)::int as c from public."${table}" where "${col}" = $1`,
      [id],
    )
  ).c;
