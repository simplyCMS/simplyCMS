import { z } from 'zod';
import { discountType } from 'simplycms/schema';
import { parseDiscountCondition } from 'simplycms/domain/discounts';
import type { Json } from 'simplycms/contracts';

/**
 * Межі дати знижки чи групи. 🔴 Не косметика: `parseDiscountRules` (межа
 * «БД → рушій», Е6в-8) читає `timestamptz` із JSON-рядка Postgres, а рік
 * ≥ 10000 чи дата до нашої ери там — не ISO, `new Date` дає `NaN`, і ОДИН
 * такий рядок валить ціноутворення ВСЬОГО магазину. Верхня межа — з
 * добовим запасом: JSON пише дату в часовому поясі сесії, і 9999-12-31 UTC
 * у поясі +03 уже стала б роком 10000.
 */
const DATE_MIN = new Date('1970-01-01T00:00:00.000Z');
const DATE_MAX = new Date('9999-12-30T00:00:00.000Z');

/** Обмежує схему дати межами рушія (рефайн групи — `discount-groups/resource.ts`). */
export const boundDiscountDate = (s: z.ZodDate) =>
  s.min(DATE_MIN).max(DATE_MAX);

const discountDate = boundDiscountDate(z.date()).nullable();

const target = z.discriminatedUnion('targetType', [
  z.object({ targetType: z.literal('all'), targetId: z.null() }),
  z.object({
    targetType: z.enum(['product', 'modification', 'section']),
    targetId: z.uuid(),
  }),
]);

// Кожна умова — через реєстр рушія (Е6в-4): невідомий тип чи значення поза
// контрактом — 400 тут, а не `condition_invalid` у кожному розрахунку ціни.
const condition = z
  .object({
    conditionType: z.string().min(1).max(100),
    operator: z.string().min(1).max(20),
    value: z.json(),
  })
  .refine(
    (c) => parseDiscountCondition(c.conditionType, c.operator, c.value as Json),
    { message: 'умова не відповідає контракту свого типу', path: ['value'] },
  );

/**
 * КАНОН вводу `saveDiscount` (Е6в-16). `discountValue` — скінченне число
 * (Zod 4 `number` не пропускає `NaN`/`Infinity`): `numeric` прийняв би
 * рядок `'NaN'`, і `parseDiscountRules` упав би на всьому магазині.
 */
export const saveDiscountInput = z
  .object({
    id: z.uuid(),
    groupId: z.uuid(),
    name: z.string().trim().min(1).max(200),
    description: z.string().max(2000).nullable(),
    discountType: z.enum(discountType.enumValues),
    discountValue: z.number().positive(),
    priceTypeId: z.uuid().nullable(),
    priority: z.int().gte(-2147483648).lte(2147483647),
    isActive: z.boolean(),
    startsAt: discountDate,
    endsAt: discountDate,
    targets: z.array(target).min(1).max(200),
    conditions: z.array(condition).max(20),
  })
  .refine((d) => d.discountType !== 'percent' || d.discountValue <= 100, {
    message: 'відсоток не більше 100',
    path: ['discountValue'],
  })
  .refine((d) => !d.startsAt || !d.endsAt || d.startsAt < d.endsAt, {
    message: 'дата початку має бути раніше за дату завершення',
    path: ['endsAt'],
  })
  // «Усі товари» — лише єдиною ціллю: поруч із нею конкретні цілі нічого не
  // звужують, а власник думав би, що звужують.
  .refine(
    (d) =>
      d.targets.length === 1 || d.targets.every((t) => t.targetType !== 'all'),
    { message: 'ціль «усі товари» — лише єдиним елементом', path: ['targets'] },
  );

export type SaveDiscountInput = z.infer<typeof saveDiscountInput>;
