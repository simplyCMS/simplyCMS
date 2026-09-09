import { is } from 'drizzle-orm';
import type { PgPolicyConfig } from 'drizzle-orm/pg-core';
import { getTableConfig, PgDialect, PgTable } from 'drizzle-orm/pg-core';

import * as authSchema from '../../src/schema/auth';
import * as mediaSchema from '../../src/schema/media';
import * as coreSchema from '../../src/schema/schema';

// Витяг політик RLS із декларацій Drizzle (Task 5, план В2-К1а).
//
// 🔴 Джерело — самі обʼєкти `pgTable`, а не текст файлу: парсер по рядках
// зламався б на першому ж перенесенні, а `getTableConfig` віддає рівно те,
// з чого drizzle-kit генерує baseline. Тобто гейт порівнює ті самі дві
// сутності, між якими й може розʼїхатись стан: SSOT-схему й накатаний канон.
//
// Модуль навмисно НЕ читає `simplycms/schema` за аліасом: конфіг гейта
// (`vitest.schema.config.ts`) аліасів не має — сюїта говорить із Postgres
// напряму й нічого з фреймворку не тягне.

/** Команди, які розрізняє `pg_policy` (`ALL` — окрема, не обʼєднання). */
export type PolicyCmd = 'ALL' | 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';

export interface DeclaredPolicy {
  table: string;
  name: string;
  permissive: boolean;
  cmd: PolicyCmd;
  roles: string[];
  using: string | null;
  withCheck: string | null;
}

const SCHEMA_MODULES = [coreSchema, authSchema, mediaSchema];

/** Ролі політики: Drizzle приймає рядок, масив або обʼєкт `pgRole`. */
function roleNames(to: PgPolicyConfig['to']): string[] {
  // `undefined` у Drizzle означає дефолт PostgreSQL — політика для PUBLIC.
  if (to === undefined) return ['public'];
  if (typeof to === 'string') return [to];
  if (Array.isArray(to)) return to.flatMap(roleNames);
  return [to.name];
}

/** Усі таблиці, оголошені в модулях схеми ядра. */
function schemaTables(): PgTable[] {
  const tables: PgTable[] = [];
  for (const module of SCHEMA_MODULES)
    for (const exported of Object.values(module))
      if (is(exported, PgTable)) tables.push(exported);
  return tables;
}

/**
 * Політики, оголошені в схемі, у формі, порівнянній із дампом `pg_policy`.
 * Порядок — за таблицею й іменем, як і в дампі.
 */
export function declaredPolicies(): DeclaredPolicy[] {
  const dialect = new PgDialect();
  const declared: DeclaredPolicy[] = [];
  for (const table of schemaTables()) {
    const config = getTableConfig(table);
    for (const policy of config.policies)
      declared.push({
        table: config.name,
        name: policy.name,
        permissive: policy.as !== 'restrictive',
        cmd: (policy.for ?? 'all').toUpperCase() as PolicyCmd,
        roles: roleNames(policy.to).sort(),
        using: policy.using ? dialect.sqlToQuery(policy.using).sql : null,
        withCheck: policy.withCheck
          ? dialect.sqlToQuery(policy.withCheck).sql
          : null,
      });
  }
  return declared.sort((a, b) =>
    a.table === b.table
      ? a.name.localeCompare(b.name)
      : a.table.localeCompare(b.table),
  );
}

/**
 * Таблиці, на яких RLS має бути ввімкнений. drizzle-kit вмикає його самим
 * фактом наявності політики, тож окремого прапорця в схемі немає — і саме
 * тому список виводиться з політик, а не з `enableRLS`.
 */
export function declaredRlsTables(): string[] {
  return [...new Set(declaredPolicies().map((policy) => policy.table))].sort();
}
