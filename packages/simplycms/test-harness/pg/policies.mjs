// Знімання політик RLS із накатаної БД + нормалізація предикатів схеми
// СИЛАМИ САМОГО POSTGRES (Task 5, план В2-К1а).
//
// 🔴 Чому нормалізація, а не порівняння рядків «як написано». `pg_get_expr`
// віддає предикат у канонічній формі планувальника, а не в авторській:
// `user_id = (select app.current_user_id())` повертається як
// `(user_id = ( SELECT app.current_user_id() AS current_user_id))`. Звіряти
// цей вивід із текстом `schema.ts` напряму неможливо, а закріпити його
// фікстурою — означало б привʼязатись до мажора Postgres (форма виводу між
// мажорами не гарантована).
//
// Вихід: предикат, оголошений у `schema.ts`, котиться на ТОЙ САМИЙ сервер
// пробною політикою у транзакції, яку одразу відкочують, і читається тим
// самим `pg_get_expr`. Обидві сторони проходять однакову нормалізацію, тож
// різниця версій скорочується, а РЕАЛЬНА зміна предиката лишається видимою.
import { queryInTransaction, queryRows } from './apply.mjs';

/** Літери `pg_policy.polcmd` → команди SQL. */
const POLICY_CMD = {
  r: 'SELECT',
  a: 'INSERT',
  w: 'UPDATE',
  d: 'DELETE',
  '*': 'ALL',
};

const PROBE_PREFIX = 'zz_parity_probe_';

/**
 * Політики схеми `public` як вони лежать у накатаній БД:
 * `{ table, name, permissive, cmd, roles, qual, withCheck }`.
 */
export async function livePolicies(url) {
  const rows = await queryRows(
    url,
    `select c.relname as table_name,
            p.polname as policy_name,
            p.polpermissive as permissive,
            p.polcmd as cmd,
            (select array_agg(pg_get_userbyid(r)::text order by pg_get_userbyid(r)::text)
               from unnest(p.polroles) r) as roles,
            pg_get_expr(p.polqual, p.polrelid) as qual,
            pg_get_expr(p.polwithcheck, p.polrelid) as with_check
       from pg_policy p
       join pg_class c on c.oid = p.polrelid
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
      order by 1, 2`,
  );
  return rows.map((row) => ({
    table: row.table_name,
    name: row.policy_name,
    permissive: row.permissive,
    cmd: POLICY_CMD[row.cmd] ?? row.cmd,
    roles: row.roles ?? [],
    qual: row.qual,
    withCheck: row.with_check,
  }));
}

/** Таблиці `public` з увімкненим RLS. */
export async function rlsEnabledTables(url) {
  const rows = await queryRows(
    url,
    `select c.relname from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity`,
  );
  return rows.map((row) => row.relname).sort();
}

/** `CREATE POLICY` для пробного накату предиката, оголошеного в схемі. */
function probeStatement(policy, index) {
  const parts = [
    `create policy "${PROBE_PREFIX}${index}" on public."${policy.table}"`,
    `as ${policy.permissive ? 'permissive' : 'restrictive'}`,
    `for ${policy.cmd.toLowerCase()}`,
    `to ${policy.roles.map((role) => `"${role}"`).join(', ')}`,
  ];
  if (policy.using !== null) parts.push(`using (${policy.using})`);
  if (policy.withCheck !== null) parts.push(`with check (${policy.withCheck})`);
  return parts.join(' ');
}

/**
 * Прогнати предикати, оголошені в `schema.ts`, через нормалізацію Postgres.
 * Усе відбувається в одній транзакції, яку `queryInTransaction` відкочує, —
 * стан БД не змінюється, тож функцію можна кликати поруч із іншими гейтами.
 */
export async function normalizePredicates(url, policies) {
  const statements = policies.map(probeStatement);
  statements.push(
    `select polname,
            pg_get_expr(polqual, polrelid) as qual,
            pg_get_expr(polwithcheck, polrelid) as with_check
       from pg_policy where polname like '${PROBE_PREFIX}%'`,
  );
  const rows = await queryInTransaction(url, statements);
  const byProbe = new Map(rows.map((row) => [row.polname, row]));
  return policies.map((policy, index) => {
    const row = byProbe.get(`${PROBE_PREFIX}${index}`);
    return {
      table: policy.table,
      name: policy.name,
      qual: row?.qual ?? null,
      withCheck: row?.with_check ?? null,
    };
  });
}
