import {
  and,
  asc,
  desc,
  eq,
  getTableName,
  gt,
  gte,
  inArray,
  lt,
  lte,
  type SQL,
} from 'drizzle-orm';
import type { Table } from 'drizzle-orm';
import { z } from 'zod';

/**
 * Єдине місце, де рядок із клієнта стає частиною SQL. field звіряється з
 * allowlist РЕСУРСУ (не зі схемою: фільтр по всіх колонках = повний
 * контроль форми запиту клієнтом); значення завжди йде параметром.
 * Оператори — рівно ті, що вміє push-down query-collection
 * (parseLoadSubsetOptions): eq, gt, gte, lt, lte, in. Невідомий — КИДАЄ.
 * `or` свідомо відкладений до Е3 (каталог) — тут його не вмикати.
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
  'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in',
  SubsetOperatorFn
> = { eq, gt, gte, lt, lte, in: inArray };

export interface SubsetAllow {
  readonly filterable: readonly string[];
  readonly sortable: readonly string[];
}

const scalar = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const filterSchema = z
  .object({
    field: z.array(z.string().min(1)).min(1),
    operator: z.enum(['eq', 'gt', 'gte', 'lt', 'lte', 'in']),
    value: z.unknown(),
  })
  // 🔴 R9 (рев'ю Task 6): форма value привʼязана до оператора ТУТ, на
  // межі, — інакше `in` зі скаляром чи `eq` з масивом доїжджають до
  // bindIfParam і повертаються 500 з БД замість 400 від валідатора.
  .superRefine((f, ctx) => {
    if (f.operator === 'in') {
      const r = z.array(scalar).min(1).safeParse(f.value);
      if (!r.success)
        ctx.addIssue({
          code: 'custom',
          path: ['value'],
          message: "operator 'in' вимагає непорожній масив скалярів",
        });
    } else if (!scalar.safeParse(f.value).success) {
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: `operator '${f.operator}' вимагає скаляр`,
      });
    }
  });
const sortSchema = z.object({
  field: z.array(z.string().min(1)).min(1),
  direction: z.enum(['asc', 'desc']),
});

/** Форма subset одного list-запиту. */
export const subsetShapeSchema = z.object({
  filters: z.array(filterSchema).max(20).optional(),
  sorts: z.array(sortSchema).max(5).optional(),
  // 🔴 limit обмежений: відкритий endpoint під адмін-роллю не сміє
  // приймати «віддай мільйон» (закриває дірку z.unknown() старої редакції).
  limit: z.number().int().positive().max(500).optional(),
  offset: z.number().int().nonnegative().optional(),
});
export type SubsetInput = z.infer<typeof subsetShapeSchema>;

/** Вхід list-serverFn: { subset? } — саме це йде в inputValidator. */
export const subsetInputSchema = z.object({
  subset: subsetShapeSchema.optional(),
});
export type SubsetPayload = z.infer<typeof subsetInputSchema>;

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
    if (!allow.filterable.includes(name))
      throw new Error(`[admin-server] фільтр по недозволеній колонці: ${name}`);
    const op = OPERATORS[f.operator as keyof typeof OPERATORS];
    if (!op)
      throw new Error(`[admin-server] невідомий оператор: ${f.operator}`);
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
