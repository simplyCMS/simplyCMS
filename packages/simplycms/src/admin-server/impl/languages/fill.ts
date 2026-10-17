import { sql } from 'drizzle-orm';
import {
  copyPathsForLocale,
  copyTokensForLocale,
  pathCandidates,
  tokenCandidates,
} from 'simplycms/addressing';
import {
  buildMissingProjection,
  missingProjectionRows,
} from 'simplycms/catalog-projection';
import type { ActorDb } from 'simplycms/db';

/** Розмір пакета за виклик: довга транзакція на 10k сутностей тримала б локи. */
export const FILL_BATCH = 500;

/**
 * Товари, яким у `code` ще бракує адреси, токена модифікації чи рядка проєкції —
 * з ТИХ САМИХ фрагментів, з яких вибирають етапи (`pathCandidates`,
 * `tokenCandidates`, `missingProjectionRows`): «бракує» тут = «етап це побудує».
 */
export async function pendingFill(
  db: ActorDb,
  code: string,
  limit: number,
): Promise<string[]> {
  const primary = sql`(select code from public.languages where is_default)`;
  const res = await db.execute<{ id: string }>(sql`
    select id from (
      select product_id as id from (${pathCandidates(primary, code)}) a
      union select scope_id from (${tokenCandidates(primary, code)}) t
      union select product_id from (${missingProjectionRows(code)}) e
    ) x order by id limit ${limit}`);
  return res.rows.map((r) => r.id);
}

/**
 * Механічний запобіжник (I-2): пакет нічого не вставив, а незроблене лишилось — вибір
 * етапів розійшовся з «бракує». Голосна відмова з переліком id замість вічного
 * `done: false`, на якому клієнт крутився б без кінця.
 */
export function stuckFill(
  op: 'fill' | 'setStatus',
  code: string,
  ids: readonly string[],
): Error {
  return new Error(
    `[languages.${op}] мова «${code}»: етапи не просуваються для товарів ${ids.join(', ')}`,
  );
}

async function stages(db: ActorDb, code: string, batch: number) {
  const paths = await copyPathsForLocale(db, code, batch);
  const tokens = await copyTokensForLocale(db, code, batch);
  const texts = await buildMissingProjection(db, code, batch);
  return {
    inserted: paths + tokens + texts,
    done: paths < batch && tokens < batch && texts < batch,
  };
}

/**
 * Один пакет заповнення мови: адреси, токени, потім проєкція тексту (вона йде
 * останньою: будується з адрес, щойно створених у цій транзакції). Ідемпотентне —
 * копіюються лише сутності без поточного запису в мові; наявні рядки проєкції fill
 * не перезаписує (їх оновлює лише команда, І23). Для мови `disabled` проєкції нема.
 * Замки — лише `FOR KEY SHARE` на товарах і модифікаціях (порядок — `products/aggregate/lock-order.ts`, пункт (5)).
 * `done`: усі три вибірки вичерпались (менше за ліміт); клієнт кличе, доки
 * `done` не стане `true`. Остаточну істину дає `completeness`.
 */
export async function fillBatch(
  db: ActorDb,
  code: string,
  batch: number = FILL_BATCH,
): Promise<{ inserted: number; done: boolean }> {
  const first = await stages(db, code, batch);
  if (first.inserted > 0) return first;
  const stuck = await pendingFill(db, code, batch);
  if (stuck.length === 0) return first;
  // Кандидат міг з'явитись у чужій транзакції вже після вибірки етапів: ще один прохід
  // його підбере. Відмова — лише для товарів, що лишились незробленими в обох перевірках.
  const again = await stages(db, code, batch);
  if (again.inserted > 0) return again;
  const still = new Set(await pendingFill(db, code, batch));
  const both = stuck.filter((id) => still.has(id));
  if (both.length > 0) throw stuckFill('fill', code, both);
  return again;
}
