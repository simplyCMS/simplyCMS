import {
  and,
  asc,
  desc,
  eq,
  getTableName,
  gt,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  type SQL,
} from 'drizzle-orm';
import type { Table } from 'drizzle-orm';
import { CURSOR_OPERATORS } from './subset-schema';
import type { SubsetInput } from './subset-schema';

export {
  subsetInputSchema,
  subsetShapeSchema,
  type SubsetInput,
  type SubsetPayload,
} from './subset-schema';

/**
 * Єдине місце, де рядок із клієнта стає частиною SQL. field звіряється з
 * allowlist РЕСУРСУ (не зі схемою: фільтр по всіх колонках = повний
 * контроль форми запиту клієнтом); значення завжди йде параметром.
 * Оператори — рівно ті, що вміє push-down query-collection
 * (parseLoadSubsetOptions): eq, gt, gte, lt, lte, in, isNull. Невідомий —
 * КИДАЄ. `or` — поза контрактом до П6 (Е3-2), тут його не вмикати.
 *
 * 🔴 isNull додано в Е3-14: ціни й залишки РІВНЯ ТОВАРУ — рядки з
 * `modification_id IS NULL`. isNull є у словнику push-down самої
 * бібліотеки (`extractSimpleComparisons`); без нього довелося б тягнути
 * ширший зріз і дофільтровувати в JS — push-down на половину.
 *
 * 🔴 Курсор «Показати ще» (@tanstack/db 0.11.3, `CursorExpressions`) шле
 * по ПЕРШІЙ колонці orderBy: `gt/lt(col, v)` та «межу рівних» — `eq(col, v)`,
 * а для Date — `and(gte(col, d), lt(col, d+1ms))`. Тому `eq/gt/gte/lt/lte`
 * дозволені по `filterable ∪ sortable`: значення відсортованої колонки
 * клієнт і так бачить у видачі, безпеки це не знижує (прихована `omit`-ом
 * колонка не потрапляє ні в filterable, ні в sortable — типи ресурсу).
 * `in/isNull` лишаються під `filterable`: курсор їх не шле. `Date` (з
 * скінченним часом) приймається ЛИШЕ діапазонними операторами — для дат
 * бібліотека `eq` не генерує; через межу serverFn Date їде нативно (seroval).
 */
// 🔴 Типізовано ЯВНИМ спільним сигнатурним типом (не `as const`): eq/gt/gte/lt/lte —
// це `BinaryOperator` (три перевантаження-в-інтерфейсі), inArray — окрема
// перевантажена generic-функція; звід `as const` дає union із НЕсумісними
// викличними сигнатурами, і виклик через індексацію не типізується
// (`TS2349: Each member of the union type … has signatures, but none of
// those signatures are compatible`). Спільний тип — той самий контракт, що
// й у виклику нижче (`columns[name] as never, f.value as never`), тож
// звуження не ослаблює перевірку: недозволена колонка все одно ловиться
// allowlist-ом ДО того, як дійде до SQL-функції.
type SubsetOperatorFn = (column: never, value: never) => SQL;
const OPERATORS: Record<
  'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'isNull',
  SubsetOperatorFn
> = {
  eq,
  gt,
  gte,
  lt,
  lte,
  in: inArray,
  isNull: ((column: never) => isNull(column)) as SubsetOperatorFn,
};

export interface SubsetAllow {
  readonly filterable: readonly string[];
  readonly sortable: readonly string[];
}

export function toDrizzleSubset(
  table: Table,
  allow: SubsetAllow,
  input: SubsetInput,
) {
  const columns = table as unknown as Record<string, never>;

  /** Колонка з allowlist мусить існувати в таблиці — одрук автора ресурсу
   *  падає тут чіткою помилкою, а не невиразно всередині SQL-білдера. */
  const column = (name: string) => {
    const col = columns[name];
    if (col === undefined)
      throw new Error(
        `[admin-server] колонки "${name}" немає в таблиці ${getTableName(table)}`,
      );
    return col;
  };

  const conditions: SQL[] = (input.filters ?? []).map((f) => {
    const name = f.field.join('.');
    const op = OPERATORS[f.operator as keyof typeof OPERATORS];
    if (!op)
      throw new Error(`[admin-server] невідомий оператор: ${f.operator}`);
    // Курсорні оператори читають і sortable-колонки; in/isNull — лише filterable.
    const allowed = CURSOR_OPERATORS.has(f.operator)
      ? [...allow.filterable, ...allow.sortable]
      : allow.filterable;
    if (!allowed.includes(name))
      throw new Error(
        `[admin-server] фільтр по недозволеній колонці: ${name} (оператор ${f.operator})`,
      );
    return op(column(name), f.value as never);
  });

  const orderBy = (input.sorts ?? []).map((s) => {
    const name = s.field.join('.');
    if (!allow.sortable.includes(name))
      throw new Error(
        `[admin-server] сортування по недозволеній колонці: ${name}`,
      );
    // Заява модуля «невідоме → кидає» діє і при прямому виклику повз схему.
    if (s.direction !== 'asc' && s.direction !== 'desc')
      throw new Error(
        `[admin-server] невідомий напрям сортування: ${String(s.direction)}`,
      );
    return (s.direction === 'desc' ? desc : asc)(column(name));
  });

  return {
    where: conditions.length === 0 ? undefined : and(...conditions),
    orderBy: orderBy.length === 0 ? undefined : orderBy,
    limit: input.limit,
    offset: input.offset,
  };
}
