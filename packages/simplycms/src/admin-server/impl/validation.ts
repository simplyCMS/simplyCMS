import { setResponseStatus } from '@tanstack/react-start/server';
import type { z } from 'zod';
import {
  sanitizeValidationIssues,
  type ValidationIssueCode,
} from 'simplycms/contracts/domain-errors';
import { ValidationError } from './errors';

/**
 * Zod-відмова → `ValidationError` (400). 🔴 ЄДИНЕ місце такого перетворення
 * для адмін-поверхні: і валідатор serverFn (`adminInput`), і повторний
 * парс у `defineAdminResource` йдуть сюди. Сире повідомлення/вхід Zod
 * далі за межу не потрапляють — лише білий список
 * (`sanitizeValidationIssues`). Статус ставиться ДО throw (сервер бере
 * його з відповіді в момент catch, К3-13): це вхід serverFn — окрема межа,
 * що виконується ДО `runAdminTransactions` (С-10).
 */
export function parseAdminInput<S extends z.ZodType>(
  schema: S,
  data: unknown,
): z.output<S> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  setResponseStatus(400);
  throw new ValidationError(sanitizeValidationIssues(result.error.issues));
}

/**
 * Валідатор serverFn адмінки: `.validator(adminInput(schema))` замість
 * `.validator(schema)`.
 *
 * 🔴 Чому не middleware. `execValidator` Start (`start-client-core`,
 * `createServerFn.js`) для будь-якої схеми з `~standard` (Zod 4 її має)
 * кидає `new Error(JSON.stringify(issues))` — Zod-помилка до middleware
 * НЕ доходить, лишається рядок; відновлювати issues парсингом
 * `error.message` крихко й неоднозначно (так виглядає й будь-який
 * хендлер, що кине JSON у повідомленні). Функція-валідатор виконується
 * тим самим `execValidator`, але її власний throw (`ValidationError`)
 * летить як є. Типи вводу/виводу зберігає сигнатура (`z.input`/
 * `z.output`), тож тип виклику на клієнті не змінюється. Повноту
 * застосування стереже `__tests__/admin-validators-wrapped.test.ts`.
 */
export function adminInput<S extends z.ZodType>(
  schema: S,
): (data: z.input<S>) => z.output<S> {
  return (data) => parseAdminInput(schema, data);
}

/**
 * Помилка ОДНОГО поля, яку знає лише операція (не схема): зайнятий email
 * (Е6г-1). Той самий канал, що й Zod-відмова, — клієнт покаже її під
 * полем (`applyServerValidation`). 🔴 Лише throw: її кидає ядро зсередини
 * операції, і 400 ставить межа (`runAdminTransactions`, С-10), а не вона.
 */
export function fieldIssue(
  path: readonly (string | number)[],
  code: ValidationIssueCode,
): never {
  throw new ValidationError([{ path, code }]);
}
