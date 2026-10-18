import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { urlPaths } from 'simplycms/schema';
import { isReservedPath } from 'simplycms/domain/slugs';
import { AdminConflictError } from 'simplycms/contracts/domain-errors';
import {
  advisoryXactLockShared,
  isUniqueViolation,
  type ActorDb,
} from 'simplycms/db';
import { LOCK_KEYS } from 'simplycms/db/lock-keys';
import {
  allocateIn,
  assertSlugFormat,
  activeLocales,
  languageSegments,
  reservedValue,
  textArray,
} from './shared';
import { publicNames } from './public-names';

/** Сутність, якій належить адреса (М2 розширює union). */
export type AddressTarget = { kind: 'product'; id: string };

/**
 * Колонка-ціль реєстру `url_paths` для кожного виду сутності — носій для `column()` (оновлення й
 * вибірки за ціллю) і `currentPathOwners`: новий вид у `AddressTarget` без рядка тут не
 * скомпілюється. 🔴 Вставки (`createPathsForEntity`, `setExplicitPath`, `copyPathsForLocale` у
 * `copy.ts`) пишуть `productId` напряму — новий вид М2 мусить перевести й їх, тип цього не змусить.
 */
export const PATH_TARGET_COLUMNS = {
  product: 'product_id',
} as const satisfies Record<AddressTarget['kind'], string>;

/** Колонка реєстру для виду сутності. */
const column = (target: AddressTarget) =>
  sql.raw(PATH_TARGET_COLUMNS[target.kind]);

const reservedFor = (langs: readonly string[]) => (candidate: string) =>
  isReservedPath(candidate, langs, publicNames());

/**
 * Поточні адреси нової сутності в усіх мовах `draft`/`published`. Спільний
 * замок `languagesSet` першим запитом, а набір мов читається ПІСЛЯ нього в тій
 * самій транзакції: додавання мови (ексклюзивний власник) чекає завершення цих
 * транзакцій і бачить усі закомічені сутності, а прочитаний до замка набір
 * пропустив би конкурентну мову (Review Focus 1, І16). Тому мов викликач не
 * передає: порядок «замок → набір» не залежить від дисципліни викликача.
 * Зайняті slug-и (поточні й історичні) читає ОДИН запит за префіксом бази, а
 * не вся адресна таблиця мови. Конкурентна вставка того самого slug-а дає
 * `unique_violation`: прихованого повтору немає.
 */
export async function createPathsForEntity(
  db: ActorDb,
  target: AddressTarget,
  baseSlug: string,
): Promise<Map<string, string>> {
  assertSlugFormat(baseSlug, 'path');
  await advisoryXactLockShared(db, LOCK_KEYS.languagesSet);
  const locales = await activeLocales(db);
  const result = new Map<string, string>();
  if (locales.length === 0) return result;
  const rows = await db.execute<{ locale: string; path: string }>(sql`
    select locale, path from public.url_paths
     where locale = any(${textArray(locales)})
       and (path = ${baseSlug} or path like ${`${baseSlug}-%`})`);
  const isReserved = reservedFor(await languageSegments(db));
  const values = locales.map((locale) => {
    const taken = new Set(
      rows.rows.filter((r) => r.locale === locale).map((r) => r.path),
    );
    const path = allocateIn(baseSlug, taken, isReserved);
    result.set(locale, path);
    return {
      locale,
      path,
      productId: target.id,
      isCurrent: true,
    };
  });
  await db
    .insert(urlPaths)
    .values(values.map((v) => ({ id: randomUUID(), ...v })));
  return result;
}

/**
 * Явна зміна адреси. Чужий поточний чи історичний шлях — 409 `path_taken`;
 * власний історичний знову стає поточним, колишній поточний іде в історію
 * (І18); зарезервований сегмент чи ім'я з `public/` — `path_reserved` (І19).
 */
export async function setExplicitPath(
  db: ActorDb,
  target: AddressTarget,
  locale: string,
  path: string,
): Promise<void> {
  assertSlugFormat(path, 'path');
  // Спільний замок ПЕРШИМ кроком, структурно (не обов'язком викликача): явна зміна
  // адреси теж створює рядок для мови, що може бути додана паралельно (майстер §3.5).
  await advisoryXactLockShared(db, LOCK_KEYS.languagesSet);
  if (reservedFor(await languageSegments(db))(path))
    throw reservedValue('path');
  const col = column(target);
  const found = await db.execute<{ owner: string | null; is_current: boolean }>(
    sql`select ${col} as owner, is_current from public.url_paths
         where locale = ${locale} and path = ${path}`,
  );
  const row = found.rows[0];
  if (row && row.owner !== target.id)
    throw new AdminConflictError('unique', 'path_taken');
  if (row?.is_current) return;
  // Поточну знімаємо ДО того, як нова чи відновлена стане поточною: частковий
  // UNIQUE (≤1 поточної) перевіряється по рядку, а не на коміті.
  await db.execute(sql`update public.url_paths set is_current = false
      where locale = ${locale} and ${col} = ${target.id} and is_current`);
  if (row) {
    await db.execute(sql`update public.url_paths set is_current = true
        where locale = ${locale} and path = ${path}`);
    return;
  }
  try {
    await db.insert(urlPaths).values({
      id: randomUUID(),
      locale,
      path,
      productId: target.id,
      isCurrent: true,
    });
  } catch (error) {
    // Лише UNIQUE самого шляху означає «зайнято»; частковий UNIQUE поточної адреси —
    // паралельна вставка, її розбирає межа (`toAdminConflict`: «повторіть»).
    if (isUniqueViolation(error, 'url_paths_locale_path_key'))
      throw new AdminConflictError('unique', 'path_taken');
    throw error;
  }
}

/** Куди веде адреса: сутність, її поточна адреса в цій мові, чи сама вона поточна. */
export async function resolvePath(
  db: ActorDb,
  locale: string,
  path: string,
): Promise<{
  target: AddressTarget;
  currentPath: string;
  isCurrent: boolean;
} | null> {
  const res = await db.execute<{
    product_id: string;
    is_current: boolean;
    current_path: string | null;
  }>(sql`select u.product_id, u.is_current, c.path as current_path
           from public.url_paths u
           left join public.url_paths c
             on c.product_id = u.product_id and c.locale = u.locale and c.is_current
          where u.locale = ${locale} and u.path = ${path}`);
  const row = res.rows[0];
  if (!row) return null;
  return {
    target: { kind: 'product', id: row.product_id },
    currentPath: row.current_path ?? path,
    isCurrent: row.is_current,
  };
}

/** Поточні адреси сутності: мова → шлях. */
export async function currentPaths(
  db: ActorDb,
  target: AddressTarget,
): Promise<Map<string, string>> {
  const res = await db.execute<{ locale: string; path: string }>(
    sql`select locale, path from public.url_paths
         where ${column(target)} = ${target.id} and is_current`,
  );
  return new Map(res.rows.map((r) => [r.locale, r.path]));
}
