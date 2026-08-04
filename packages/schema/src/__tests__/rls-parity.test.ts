import { describe, expect, it } from 'vitest';
import { is } from 'drizzle-orm';
import {
  PgDialect,
  PgRole,
  PgTable,
  getTableConfig,
} from 'drizzle-orm/pg-core';
import type { PgPolicy } from 'drizzle-orm/pg-core';
import * as schema from '../schema';
import fixture from './fixtures/rls-policies.json';

// Blocking-gate (spec D6): RLS у `schema.ts` мусить збігатися з живою БД
// ПОВНОПОЛЬОВО — не «є/нема», а кортеж
// (table, policyname, cmd, permissive, roles, qual, with_check).
// Фікстура — закомічений дамп `pg_policies`, оновлюється командою
// `pnpm db:dump-rls` (див. README пакета).

interface PolicyTuple {
  table: string;
  policyname: string;
  cmd: string;
  permissive: string;
  roles: string;
  qual: string | null;
  withCheck: string | null;
}

// Нормалізація SQL-виразу: lowercase + колапс пробілів. Форматування не дає
// фальшивих падінь, але зміна предиката політики тест НЕ пройде.
const normSql = (value: string | null | undefined): string | null =>
  value === null || value === undefined
    ? null
    : value.toLowerCase().replace(/\s+/g, ' ').trim();

const dialect = new PgDialect();
const sqlOf = (value: PgPolicy['using']): string | null =>
  value === undefined ? null : normSql(dialect.sqlToQuery(value).sql);

// pg повертає `roles` як рядок-масив `{public}` — зводимо до сортованого CSV.
const rolesFromDb = (raw: string): string =>
  raw
    .replace(/^\{/u, '')
    .replace(/\}$/u, '')
    .split(',')
    .map((role) => role.trim())
    .filter(Boolean)
    .sort()
    .join(',');

const roleName = (role: unknown): string =>
  typeof role === 'string' ? role : is(role, PgRole) ? role.name : String(role);

const rolesFromSchema = (to: PgPolicy['to']): string => {
  if (to === undefined) return 'public';
  const list: readonly unknown[] = Array.isArray(to) ? to : [to];
  return list.map(roleName).sort().join(',');
};

const expected = new Map<string, PolicyTuple>(
  fixture.policies.map((policy) => [
    `${policy.tablename}|${policy.policyname}`,
    {
      table: policy.tablename,
      policyname: policy.policyname,
      cmd: policy.cmd.toUpperCase(),
      permissive: policy.permissive.toUpperCase(),
      roles: rolesFromDb(policy.roles),
      qual: normSql(policy.qual),
      withCheck: normSql(policy.with_check),
    },
  ]),
);

const actual = new Map<string, PolicyTuple>();
const schemaRlsTables: string[] = [];

for (const value of Object.values(schema)) {
  if (!is(value, PgTable)) continue;
  const config = getTableConfig(value);
  // У Drizzle таблиця з політиками — RLS-enabled навіть без явного `.enableRLS()`.
  if (config.enableRLS || config.policies.length > 0)
    schemaRlsTables.push(config.name);
  for (const policy of config.policies) {
    actual.set(`${config.name}|${policy.name}`, {
      table: config.name,
      policyname: policy.name,
      cmd: (policy.for ?? 'all').toUpperCase(),
      permissive: (policy.as ?? 'permissive').toUpperCase(),
      roles: rolesFromSchema(policy.to),
      qual: sqlOf(policy.using),
      withCheck: sqlOf(policy.withCheck),
    });
  }
}

const sorted = (keys: Iterable<string>): string[] => [...keys].sort();

describe('RLS parity: жива БД ↔ packages/schema/src/schema.ts', () => {
  it('фікстура не порожня (захист від «зеленого» тесту на порожньому дампі)', () => {
    expect(fixture.policies.length).toBeGreaterThan(0);
    expect(fixture.rlsEnabledTables.length).toBeGreaterThan(0);
  });

  it('множина політик збігається в обидва боки', () => {
    expect(sorted(actual.keys())).toEqual(sorted(expected.keys()));
  });

  it('кожна політика збігається повнопольово', () => {
    for (const [key, tuple] of expected) {
      expect(actual.get(key), `політика відсутня в schema.ts: ${key}`).toEqual(
        tuple,
      );
    }
  });

  it('немає політик, яких немає в БД', () => {
    for (const [key, tuple] of actual) {
      expect(expected.get(key), `політики немає в БД: ${key}`).toEqual(tuple);
    }
  });

  it('список RLS-enabled таблиць збігається', () => {
    expect(sorted(schemaRlsTables)).toEqual(sorted(fixture.rlsEnabledTables));
  });
});
