import { z } from 'zod';

/**
 * Схема входу list-serverFn (межа 400): форма subset і привʼязка value до
 * оператора. Виконання в SQL — `subset.ts`. Курсор «Показати ще»
 * (@tanstack/db 0.11.3) шле gt/gte/lt/lte і для Date; `Date` зі скінченним
 * часом приймається ЛИШЕ діапазонними операторами (для дат `eq` бібліотека
 * не генерує), числа — лише скінченні; через межу serverFn Date їде нативно
 * (seroval).
 */
const scalar = z.union([z.string(), z.number(), z.boolean(), z.null()]);
/** Значення діапазонного оператора: скаляр, але число — скінченне, або Date зі скінченним часом. */
const rangeValue = z.union([
  z.string(),
  z.number().refine(Number.isFinite),
  z.boolean(),
  z.null(),
  z.date().refine((d) => Number.isFinite(d.getTime())),
]);
export const RANGE_OPERATORS = new Set(['gt', 'gte', 'lt', 'lte']);
export const CURSOR_OPERATORS = new Set(['eq', ...RANGE_OPERATORS]);
const filterSchema = z
  .object({
    field: z.array(z.string().min(1)).min(1),
    operator: z.enum(['eq', 'gt', 'gte', 'lt', 'lte', 'in', 'isNull']),
    value: z.unknown(),
  })
  // 🔴 R9 (рев'ю Task 6): форма value привʼязана до оператора ТУТ, на
  // межі, — інакше `in` зі скаляром чи `eq` з масивом доїжджають до
  // bindIfParam і повертаються 500 з БД замість 400 від валідатора.
  // isNull (Е3-14) — той самий принцип: value мусить бути РІВНО null,
  // інакше клієнт міг би прислати сміття, яке SQL-білдер просто ігнорує.
  .superRefine((f, ctx) => {
    if (f.operator === 'in') {
      const r = z.array(scalar).min(1).safeParse(f.value);
      if (!r.success)
        ctx.addIssue({
          code: 'custom',
          path: ['value'],
          message: "operator 'in' вимагає непорожній масив скалярів",
        });
    } else if (f.operator === 'isNull') {
      if (f.value !== null)
        ctx.addIssue({
          code: 'custom',
          path: ['value'],
          message: "operator 'isNull' вимагає value: null",
        });
    } else if (
      !(RANGE_OPERATORS.has(f.operator) ? rangeValue : scalar).safeParse(
        f.value,
      ).success
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: RANGE_OPERATORS.has(f.operator)
          ? `operator '${f.operator}' вимагає скінченний скаляр або Date`
          : `operator '${f.operator}' вимагає скаляр`,
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

/** Вхід list-serverFn: { subset? } — саме це йде в validator. */
export const subsetInputSchema = z.object({
  subset: subsetShapeSchema.optional(),
});
export type SubsetPayload = z.infer<typeof subsetInputSchema>;
