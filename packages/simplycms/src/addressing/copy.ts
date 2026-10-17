import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { slugTokens, urlPaths } from 'simplycms/schema';
import { isReservedPath } from 'simplycms/domain/slugs';
import type { ActorDb } from 'simplycms/db';
import {
  allocateIn,
  candidateAny,
  languageSegments,
  primaryLocale,
  textArray,
} from './shared';
import { publicNames } from './public-names';

// Пакетне заповнення нової мови копіями поточних адрес/токенів основної (М1,
// Review Focus 2). Ідемпотентне: вибираються лише сутності БЕЗ поточного
// запису в новій мові, тож повторний виклик продовжує, а не дублює.
// 🔴 `FOR KEY SHARE` на батьківському рядку (товар / модифікація): вибірка йде зі
// знімка, а паралельне видалення сутності до коміту дало б на вставці FK 23503
// (409 `reference`). Заблокований рядок, видалений у чужій транзакції, після її коміту
// пропускається — сутності вже немає, копіювати нічого. KEY SHARE не конфліктує з
// командами (NO KEY UPDATE), тож `lockProduct` цієї вставки не блокує.
// Кандидати всього пакета читає ОДИН запит (`candidateAny`: ланцюг `=`/`LIKE` по індексу); множина
// зайнятих поповнюється в пам'яті після кожної алокації.

/** Скільки сутностей мови ще без адреси копіюється за виклик; 0 = завершено. */
export async function copyPathsForLocale(
  db: ActorDb,
  locale: string,
  limit: number,
): Promise<number> {
  const primary = await primaryLocale(db);
  const batch = await db.execute<{ product_id: string; path: string }>(sql`
    select p.product_id, p.path from public.url_paths p
      join public.products pr on pr.id = p.product_id
     where p.locale = ${primary} and p.is_current and p.product_id is not null
       and not exists (
         select 1 from public.url_paths t
          where t.locale = ${locale} and t.product_id = p.product_id and t.is_current)
     order by p.path, p.product_id limit ${limit}
     for key share of pr`);
  if (batch.rows.length === 0) return 0;
  const bases = [...new Set(batch.rows.map((r) => r.path))];
  const rows = await db.execute<{ path: string }>(sql`
    select path from public.url_paths
     where locale = ${locale}
       and ${candidateAny(sql`path`, bases)}`);
  const taken = new Set(rows.rows.map((r) => r.path));
  const langs = await languageSegments(db);
  const names = publicNames();
  const values = batch.rows.map((r) => ({
    locale,
    path: allocateIn(r.path, taken, (c) => isReservedPath(c, langs, names)),
    productId: r.product_id,
    isCurrent: true,
  }));
  await db
    .insert(urlPaths)
    .values(values.map((v) => ({ id: randomUUID(), ...v })));
  return values.length;
}

/** Дзеркало для токенів модифікацій: простір `(locale, token_kind, scope_id)`. */
export async function copyTokensForLocale(
  db: ActorDb,
  locale: string,
  limit: number,
): Promise<number> {
  const primary = await primaryLocale(db);
  const batch = await db.execute<{
    modification_id: string;
    scope_id: string;
    slug: string;
  }>(sql`
    select p.modification_id, p.scope_id, p.slug from public.slug_tokens p
      join public.product_modifications m on m.id = p.modification_id
     where p.locale = ${primary} and p.is_current and p.token_kind = 'modification'
       and not exists (
         select 1 from public.slug_tokens t
          where t.locale = ${locale} and t.modification_id = p.modification_id
            and t.is_current)
     order by p.scope_id, p.slug, p.modification_id limit ${limit}
     for key share of m`);
  if (batch.rows.length === 0) return 0;
  const bases = [...new Set(batch.rows.map((r) => r.slug))];
  const scopes = [...new Set(batch.rows.map((r) => r.scope_id))];
  const rows = await db.execute<{ scope_id: string; slug: string }>(sql`
    select scope_id, slug from public.slug_tokens
     where locale = ${locale} and token_kind = 'modification'
       and scope_id = any(${textArray(scopes)}::uuid[])
       and ${candidateAny(sql`slug`, bases)}`);
  const takenByScope = new Map<string, Set<string>>();
  for (const r of rows.rows) {
    const set = takenByScope.get(r.scope_id) ?? new Set<string>();
    set.add(r.slug);
    takenByScope.set(r.scope_id, set);
  }
  const values = batch.rows.map((r) => {
    const taken = takenByScope.get(r.scope_id) ?? new Set<string>();
    takenByScope.set(r.scope_id, taken);
    return {
      locale,
      slug: allocateIn(r.slug, taken),
      scopeId: r.scope_id,
      modificationId: r.modification_id,
      isCurrent: true,
    };
  });
  await db
    .insert(slugTokens)
    .values(values.map((v) => ({ id: randomUUID(), ...v })));
  return values.length;
}
