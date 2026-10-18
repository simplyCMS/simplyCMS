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

/** Режим виклику fill: лише адреси й токени (спільний set) або все з проєкцією (ексклюзивний). */
export type FillMode = 'addresses' | 'projection';

/**
 * Чи бракує мові адрес або токенів — з тих самих фрагментів, що копіювання. Читається ДО
 * першого замка виклику лише для вибору режиму: застаріла відповідь безпечна (режим
 * `projection` теж копіює адреси, режим `addresses` проєкції не будує взагалі).
 */
export async function needsAddresses(
  db: ActorDb,
  code: string,
): Promise<boolean> {
  const primary = sql`(select code from public.languages where is_default)`;
  const res = await db.execute<{ yes: boolean }>(sql`
    select exists (${pathCandidates(primary, code)})
        or exists (${tokenCandidates(primary, code)}) as yes`);
  return res.rows[0]?.yes === true;
}

/**
 * Етапи пакета за режимом. 🔴 Проєкцію будує лише виклик під ЕКСКЛЮЗИВНИМ `languages-set`
 * (`languagesFill`, пункт (2) `lock-order.ts`): кожна команда товару тримає СПІЛЬНИЙ set від
 * `lockAggregateRoots` до коміту, тож такий виклик чекає коміту всіх команд у польоті й читає
 * закомічене джерело; команди, що стартують після нього, бачать закомічені адреси й рядки
 * проєкції і пишуть свій рядок самі (`DO UPDATE`). Під спільним set побудова зі знімка
 * програвала б команді, чий refresh пройшов ДО коміту адрес, а коміт — після побудови: рядок
 * лишався б застарілим назавжди (І23, проба фінального рев'ю). Адреси й токени копіюються під
 * спільним set — команди й створення товарів у цей час не чекають.
 */
async function stages(
  db: ActorDb,
  code: string,
  batch: number,
  mode: FillMode,
) {
  const paths = await copyPathsForLocale(db, code, batch);
  const tokens = await copyTokensForLocale(db, code, batch);
  if (mode === 'addresses') return paths + tokens;
  return paths + tokens + (await buildMissingProjection(db, code, batch));
}

/** Що ще лишилось зробити В ЦЬОМУ режимі (для запобіжника прогресу). */
async function pendingFor(
  db: ActorDb,
  code: string,
  batch: number,
  mode: FillMode,
): Promise<string[]> {
  if (mode === 'projection') return pendingFill(db, code, batch);
  return (await needsAddresses(db, code)) ? pendingFill(db, code, batch) : [];
}

/**
 * Один пакет заповнення мови. Режим `addresses` — адреси й токени під спільним set;
 * `projection` — те саме плюс проєкція тексту під ексклюзивним (див. `stages`). Ідемпотентне —
 * копіюються лише сутності без поточного запису в мові; наявні рядки проєкції fill не
 * перезаписує (їх оновлює лише команда, І23). Для мови `disabled` проєкції нема.
 * Замки рядків — лише `FOR KEY SHARE` на товарах і модифікаціях (порядок —
 * `products/aggregate/lock-order.ts`, пункт (5)).
 * `inserted` — фактично вставлені рядки (`RETURNING`). `done` — за ТИМ САМИМ предикатом
 * (`pendingFill`) після пакета роботи для мови не лишилось: у режимі `addresses` відсутні
 * рядки проєкції лишаються в `pendingFill`, тож `done: true` з незбудованою проєкцією
 * неможливе; не «вставили менше за ліміт»: рядок, який пропустив `ON CONFLICT` чи
 * паралельне видалення, зменшує лічильник, але не означає, що решта мови готова. Клієнт
 * кличе, доки `done` не стане `true`; остаточну істину дає `completeness`.
 */
export async function fillBatch(
  db: ActorDb,
  code: string,
  batch: number,
  mode: FillMode,
): Promise<{ inserted: number; done: boolean }> {
  const inserted = await stages(db, code, batch, mode);
  const done = async () => (await pendingFill(db, code, 1)).length === 0;
  const left = await pendingFor(db, code, batch, mode);
  if (inserted > 0 || left.length === 0)
    return { inserted, done: await done() };
  // Нічого не вставлено, а робота цього режиму лишилась: кандидат міг з'явитись у чужій
  // транзакції вже після вибірки етапів — ще один прохід його підбере. Відмова — лише для
  // товарів, що лишились незробленими в обох перевірках.
  const again = await stages(db, code, batch, mode);
  const still = await pendingFor(db, code, batch, mode);
  if (again > 0 || still.length === 0)
    return { inserted: again, done: await done() };
  const both = left.filter((id) => still.includes(id));
  if (both.length > 0) throw stuckFill('fill', code, both);
  return { inserted: 0, done: false };
}
