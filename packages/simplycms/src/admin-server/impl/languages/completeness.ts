import { sql } from 'drizzle-orm';
import { localeProjectionMismatches } from 'simplycms/catalog-projection';
import { ValidationError } from 'simplycms/contracts/domain-errors';
import type { ActorDb } from 'simplycms/db';

/** Етап, якого бракує товару: адреса, токен модифікації чи рядок проєкції тексту. */
export type IncompleteStage = 'path' | 'token' | 'projection';

export interface IncompleteItem {
  readonly productId: string;
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
        a.productId.localeCompare(b.productId),
    )
    .filter((r) => {
      const key = `${r.stage}:${r.productId}`;
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
  const mismatches = await localeProjectionMismatches(db, code);
  const missingPaths = Number(counts.rows[0]?.paths ?? 0);
  const missingTokens = Number(counts.rows[0]?.tokens ?? 0);
  return {
    complete: missingPaths + missingTokens + mismatches.length === 0,
    missingPaths,
    missingTokens,
    missingProjection: mismatches.length,
    incomplete: sample([
      ...examples.rows.map((r) => ({ productId: r.id, stage: r.stage })),
      ...mismatches.map((k) => ({
        productId: k.productId,
        stage: 'projection' as const,
      })),
    ]),
  };
}

/**
 * Відмова публікації неповної мови. Перша проблема — на поле `status` (форма), далі по одній
 * на кожен приклад: `['products', id, етап]`. Деталі — саме в `path`, бо це єдине, що
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
      path: ['products', i.productId, i.stage],
      code: 'language_incomplete' as const,
    })),
  ]);
}
