/**
 * Колонки `numeric` приходять з БД decimal-РЯДКОМ (`"1234.50"`), а
 * `useFormatPrice` приймає `number` — перетворення робиться лише тут, на межі
 * показу. `null`/нечисловий рядок → 0, щоб сума ніколи не стала `NaN` в UI.
 */
export function toAmount(value: string | null): number {
  if (value === null) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
