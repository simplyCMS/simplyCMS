// Знімання ФАКТИЧНОГО стану привілеїв і політик із живої БД харнеса
// (Task 4, план В2-К1а). Виділено з тесту в окремий `.mjs` із двох причин:
// SQL тут переживе Task 5 (поведінкова матриця RLS читає ті самі політики),
// а `pg` без `@types/pg` неможливо імпортувати з `.test.ts` (TS7016).
//
// 🔴 Джерело — `aclexplode()` над `pg_class.relacl`/`pg_proc.proacl`, а не
// `information_schema.role_table_grants`: information_schema показує лише те,
// де поточний користувач грантор, грантований або член ролі, тож під іншим
// конектом мовчки віддав би НЕПОВНУ картину — а неповна картина в гейті
// привілеїв гірша за її відсутність. `aclexplode` бачить ACL цілком, разом
// із записом для PUBLIC (grantee = 0).
import { queryRows } from './apply.mjs';

/** Літери `pg_policy.polcmd` → команди SQL. */
const POLICY_CMD = {
  r: ['SELECT'],
  a: ['INSERT'],
  w: ['UPDATE'],
  d: ['DELETE'],
  '*': ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
};

const sorted = (values) => [...new Set(values)].sort();

/**
 * Фактичні гранти по таблицях `public`: `{ table: { role: ['SELECT', …] } }`.
 * `roles` фільтрує вибірку (власник таблиць у різних оточеннях зветься
 * по-різному — `postgres`, `pgtest`, роль деплою — і до контракту не
 * належить); `'PUBLIC'` теж можна передати як ім'я.
 */
export async function tableGrants(url, roles) {
  const rows = await queryRows(
    url,
    `select c.relname as table_name,
            case when a.grantee = 0 then 'PUBLIC'
                 else pg_get_userbyid(a.grantee) end as role_name,
            a.privilege_type as privilege
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       cross join lateral aclexplode(c.relacl) a
      where n.nspname = 'public' and c.relkind = 'r'`,
  );
  const matrix = {};
  for (const row of rows) {
    if (roles && !roles.includes(row.role_name)) continue;
    matrix[row.table_name] ??= {};
    const bucket = (matrix[row.table_name][row.role_name] ??= []);
    bucket.push(row.privilege);
  }
  for (const table of Object.values(matrix))
    for (const [role, privileges] of Object.entries(table))
      table[role] = sorted(privileges);
  return matrix;
}

/**
 * Функції схем `app` і `public` з їхнім ACL: по рядку на пару
 * «функція × грантований». Функція без жодного гранта теж повертається
 * (з `role_name: null`) — інакше зникла б із поля зору гейта.
 */
export async function functionGrants(url) {
  return queryRows(
    url,
    `select n.nspname || '.' || p.proname as function_name,
            p.prosecdef as security_definer,
            case when a.grantee = 0 then 'PUBLIC'
                 else pg_get_userbyid(a.grantee) end as role_name,
            a.privilege_type as privilege
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       left join lateral aclexplode(p.proacl) a on true
      where n.nspname in ('app', 'public')
      order by 1, 3`,
  );
}

/**
 * Команди, дозволені політиками RLS: `{ table: { role: ['SELECT', …] } }`.
 * Саме з цим зрізом гейт звіряє гранти RLS-таблиць — розходження означає
 * або мертвий привілей, або мертву політику.
 */
export async function policyCommands(url) {
  const rows = await queryRows(
    url,
    `select c.relname as table_name,
            p.polcmd as cmd,
            (select array_agg(pg_get_userbyid(r)::text)
               from unnest(p.polroles) r) as role_names
       from pg_policy p
       join pg_class c on c.oid = p.polrelid
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'`,
  );
  const matrix = {};
  for (const row of rows) {
    matrix[row.table_name] ??= {};
    for (const role of row.role_names ?? []) {
      const bucket = (matrix[row.table_name][role] ??= []);
      bucket.push(...(POLICY_CMD[row.cmd] ?? []));
    }
  }
  for (const table of Object.values(matrix))
    for (const [role, cmds] of Object.entries(table))
      table[role] = sorted(cmds);
  return matrix;
}

/** Імена сиквенсів у `public` (у baseline v2 їх нема — усі PK — uuid). */
export async function sequenceNames(url) {
  const rows = await queryRows(
    url,
    `select c.relname from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'S'`,
  );
  return rows.map((row) => row.relname).sort();
}
