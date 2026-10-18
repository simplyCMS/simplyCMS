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
import { keyShare, pathCandidates, tokenCandidates } from './copy-candidates';
import { publicNames } from './public-names';

// Пакетне заповнення нової мови копіями поточних адрес/токенів основної (М1,
// Review Focus 2). Ідемпотентне: вибираються лише сутності БЕЗ поточного
// запису в новій мові, тож повторний виклик продовжує, а не дублює.
// 🔴 Вибір кандидатів — спільні фрагменти `copy-candidates.ts` (і для перевірки прогресу fill).
// 🔴 Замки: лише `FOR KEY SHARE` на батьківських рядках, ЗАВЖДИ «товар -> модифікації»
// і кожен рівень за id (порядок замків агрегата, `products/aggregate/lock-order.ts`). KEY SHARE сумісний із
// `NO KEY UPDATE` команд і каскаду `SET NULL` розділу; паралельне видалення товару чи
// модифікації до коміту інакше дало б на вставці FK 23503 — заблокований рядок, видалений
// у чужій транзакції, після її коміту просто пропускається.
// Кандидати всього пакета читає ОДИН запит (`candidateAny`: ланцюг `=`/`LIKE` по індексу); множина
// зайнятих поповнюється в пам'яті після кожної алокації.

/** Скільки сутностей мови ще без адреси копіюється за виклик; 0 = завершено. */
export async function copyPathsForLocale(
  db: ActorDb,
  locale: string,
  limit: number,
): Promise<number> {
  const primary = await primaryLocale(db);
  const candidates = await db.execute<{ product_id: string; path: string }>(sql`
    select c.product_id, c.path from (${pathCandidates(primary, locale)}) c
     order by c.path, c.product_id limit ${limit}`);
  const roots = await keyShare(
    db,
    'products',
    candidates.rows.map((r) => r.product_id),
  );
  const batch = {
    rows: candidates.rows.filter((r) => roots.has(r.product_id)),
  };
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
  // Поточну адресу (L, товар) могла вставити паралельна команда (`setPath` під своїм
  // коренем, KEY SHARE fill її не чекає): явна адреса — вже «не бракує», тож ціль —
  // САМЕ частковий UNIQUE поточного запису; конфлікт шляху (`locale, path`) летить як є.
  const inserted = await db
    .insert(urlPaths)
    .values(values.map((v) => ({ id: randomUUID(), ...v })))
    .onConflictDoNothing({
      target: [urlPaths.locale, urlPaths.productId],
      where: sql.raw('is_current and product_id is not null'),
    })
    .returning({ id: urlPaths.id });
  return inserted.length;
}

/** Дзеркало для токенів модифікацій: простір `(locale, token_kind, scope_id)`. */
export async function copyTokensForLocale(
  db: ActorDb,
  locale: string,
  limit: number,
): Promise<number> {
  const primary = await primaryLocale(db);
  const candidates = await db.execute<{
    modification_id: string;
    scope_id: string;
    slug: string;
  }>(sql`
    select c.modification_id, c.scope_id, c.slug
      from (${tokenCandidates(primary, locale)}) c
     order by c.scope_id, c.slug, c.modification_id limit ${limit}`);
  if (candidates.rows.length === 0) return 0;
  // Спершу товари, потім модифікації — кожен рівень окремим запитом за id: порядок
  // «корінь -> модифікації» той самий, що в видалячів (`deleteModifications`) і в інших
  // кроках fill. Щодо дедлоку корінь тут надлишковий (проєкція — окрема транзакція під
  // ексклюзивним set, FK токенів веде лише на модифікації); він потрібен для однакового
  // порядку й щоб пропускати вже видалені товари.
  const roots = await keyShare(
    db,
    'products',
    candidates.rows.map((r) => r.scope_id),
  );
  const mods = await keyShare(
    db,
    'product_modifications',
    candidates.rows
      .filter((r) => roots.has(r.scope_id))
      .map((r) => r.modification_id),
  );
  const batch = {
    rows: candidates.rows.filter(
      (r) => roots.has(r.scope_id) && mods.has(r.modification_id),
    ),
  };
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
  // Як в адрес: ціль — частковий UNIQUE поточного токена модифікації в мові.
  const inserted = await db
    .insert(slugTokens)
    .values(values.map((v) => ({ id: randomUUID(), ...v })))
    .onConflictDoNothing({
      target: [slugTokens.locale, slugTokens.modificationId],
      where: sql.raw('is_current and modification_id is not null'),
    })
    .returning({ id: slugTokens.id });
  return inserted.length;
}
