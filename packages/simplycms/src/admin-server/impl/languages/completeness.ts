import { sql } from 'drizzle-orm';
import { localeProjectionMismatches } from 'simplycms/catalog-projection';
import { ValidationError } from 'simplycms/contracts/domain-errors';
import type { ActorDb } from 'simplycms/db';
import {
  pathSegmentOf,
  type AddressTarget,
  type TokenTarget,
} from 'simplycms/addressing';
import { ADDRESS_KIND } from 'simplycms/domain';

/** Етап, якого бракує товару: адреса, токен модифікації чи рядок проєкції тексту. */
export type IncompleteStage = 'path' | 'token' | 'projection';

/** Чого бракує: вид цілі з реєстру `addressing` (невідомий вид — помилка типу), id і етап. */
export interface IncompleteItem {
  readonly kind: AddressTarget['kind'] | TokenTarget['kind'];
  /**
   * `id` належить простору `pathSegment` виду: це id сутності, чия картка усуває прогалину, а не
   * обов'язково id відсутнього рядка (Д13). Напр. modification → `pathSegment` 'products', id —
   * id товару. Правило не товарне: майбутній вид (опція) матиме свій `pathSegment` і свій id.
   */
  readonly id: string;
  readonly stage: IncompleteStage;
}

/**
 * Скільки прикладів «що бракує» повертати. Межа — щоб відмова публікації не роздувалась на
 * 10k товарів; власнику досить побачити перші, а повний лік дають лічильники.
 */
export const INCOMPLETE_SAMPLE = 20;

const STAGE_ORDER: readonly IncompleteStage[] = ['path', 'token', 'projection'];

export interface Completeness {
  readonly complete: boolean;
  readonly missingPaths: number;
  readonly missingTokens: number;
  /**
   * Розбіжності проєкції тексту мови із джерелом: відсутні + застарілі + зайві
   * (той самий розрахунок, що `reconcileProductTexts`, лише читання). Для мови
   * `disabled` проєкції немає за побудовою — 0.
   */
  readonly missingProjection: number;
  /**
   * Перші (за етапом, потім id) товари, яким бракує етапу: без них відмова публікації
   * лишала б власника з лічильником і без відповіді «який товар винен».
   */
  readonly incomplete: readonly IncompleteItem[];
}

/** Перші `INCOMPLETE_SAMPLE` пар «товар × етап» без повторів (дві модифікації — один приклад). */
function sample(rows: readonly IncompleteItem[]): IncompleteItem[] {
  const seen = new Set<string>();
  return [...rows]
    .sort(
      (a, b) =>
        STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage) ||
        a.id.localeCompare(b.id),
    )
    .filter((r) => {
      const key = `${r.stage}:${r.kind}:${r.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, INCOMPLETE_SAMPLE);
}

/**
 * Повнота мови (І16): кожен товар має поточну адресу, кожна модифікація —
 * поточний токен у цій мові, проєкція тексту товарів збігається з джерелом.
 * Публікація без повноти дала б 404 на сторінках, які в основній мові існують. Рахуємо від самих сутностей, а не від адрес
 * основної мови: сутність без адреси в основній теж є дефектом повноти.
 */
export async function completeness(
  db: ActorDb,
  code: string,
): Promise<Completeness> {
  // Лічильники — агрегатом у SQL, приклади — `LIMIT`: каталог на 10k товарів і 30k
  // модифікацій не має тягнутись у Node лише заради 20 прикладів.
  const noPath = sql`from public.products p where not exists (
       select 1 from public.url_paths t
        where t.locale = ${code} and t.product_id = p.id and t.is_current)`;
  const noToken = sql`from public.product_modifications m where not exists (
       select 1 from public.slug_tokens t
        where t.locale = ${code} and t.modification_id = m.id and t.is_current)`;
  const counts = await db.execute<{ paths: string; tokens: string }>(sql`
    select (select count(*) ${noPath}) as paths, (select count(*) ${noToken}) as tokens`);
  const examples = await db.execute<{
    id: string;
    stage: 'path' | 'token';
  }>(sql`
    (select p.id::text as id, 'path' as stage ${noPath} order by p.id limit ${INCOMPLETE_SAMPLE})
    union all
    (select id, 'token' from (select distinct m.product_id::text as id ${noToken}) d
      order by id limit ${INCOMPLETE_SAMPLE})`);
  const projection = await localeProjectionMismatches(
    db,
    code,
    INCOMPLETE_SAMPLE,
  );
  const missingPaths = Number(counts.rows[0]?.paths ?? 0);
  const missingTokens = Number(counts.rows[0]?.tokens ?? 0);
  return {
    complete: missingPaths + missingTokens + projection.count === 0,
    missingPaths,
    missingTokens,
    missingProjection: projection.count,
    incomplete: sample([
      ...examples.rows.map((r) => ({
        kind:
          r.stage === 'path' ? ADDRESS_KIND.product : ADDRESS_KIND.modification,
        id: r.id,
        stage: r.stage,
      })),
      ...projection.sample.map((k) => ({
        kind: ADDRESS_KIND.product,
        id: k.productId,
        stage: 'projection' as const,
      })),
    ]),
  };
}

/**
 * Відмова публікації мови без пакета (§19.15, І46): на поле `status`, тим самим шляхом, що
 * й `language_incomplete`. Пакет перевіряється ДО повноти: неповну мову без пакета
 * однаково не опублікувати, а відмова про пакет не залежить від кількості даних.
 */
export function languagePackMissingError(): ValidationError {
  return new ValidationError([
    { path: ['status'], code: 'language_pack_missing' },
  ]);
}

/**
 * Відмова публікації неповної мови. Перша проблема — на поле `status` (форма), далі по одній
 * на кожен приклад: `[сегмент виду з реєстру, id, етап]` (для товару й модифікації — `['products', id, етап]`). Деталі — саме в `path`, бо це єдине, що
 * несуть обидва транспорти (problem+json `/api/v1` віддає лише path і code, serverFn —
 * білий список `sanitizeValidationIssues`). Без них власник бачив би «мова неповна» і не
 * знав, який товар перезберегти чи дозаповнити.
 */
export function languageIncompleteError(
  items: readonly IncompleteItem[],
): ValidationError {
  return new ValidationError([
    { path: ['status'], code: 'language_incomplete' },
    ...items.map((i) => ({
      path: [pathSegmentOf(i.kind), i.id, i.stage],
      code: 'language_incomplete' as const,
    })),
  ]);
}
