/**
 * Формат значення числової властивості (`numeric_value`, Тема 12). Колонка
 * — `numeric(15, 4)` (`schema/schema.ts`, `product_property_values`);
 * сервер відхиляє зайві цифри (`invalid_decimal`), а клієнт НЕ має їх
 * слати і не має слати експоненту (`String(Number('0.0000001'))` → `'1e-7'`).
 * Паритет констант із колонкою стереже `__tests__/number-format.test.ts`.
 */
export const NUMERIC_VALUE_PRECISION = 15;
export const NUMERIC_VALUE_SCALE = 4;

/**
 * Рядок із поля вводу → простий десятковий рядок БЕЗ експоненти й без
 * хвостових нулів дробової частини (`'1e-7'` → `'0.0000001'`, `'1.50'` →
 * `'1.5'`, `'-0'` → `'0'`). Дробове зсувається рядково, без `Number`, тож
 * точність не втрачається. `null` — не число.
 */
export function toPlainDecimal(raw: string): string | null {
  const m = /^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(raw.trim());
  if (!m || ((m[2] ?? '') === '' && (m[3] ?? '') === '')) return null;
  const exp = Number(m[4] ?? 0);
  if (Math.abs(exp) > 400) return null;
  const digits = (m[2] ?? '') + (m[3] ?? '');
  const pos = (m[2] ?? '').length + exp;
  let int: string;
  let frac: string;
  if (pos <= 0) {
    int = '0';
    frac = '0'.repeat(-pos) + digits;
  } else if (pos >= digits.length) {
    int = digits.padEnd(pos, '0');
    frac = '';
  } else {
    int = digits.slice(0, pos);
    frac = digits.slice(pos);
  }
  int = int.replace(/^0+(?=\d)/, '');
  frac = frac.replace(/0+$/, '');
  const zero = /^0*$/.test(int) && frac === '';
  return `${m[1] === '-' && !zero ? '-' : ''}${int}${frac ? `.${frac}` : ''}`;
}

/** Чи вміщається простий десятковий рядок у `numeric(precision, scale)`. */
export function fitsNumeric(
  plain: string,
  precision = NUMERIC_VALUE_PRECISION,
  scale = NUMERIC_VALUE_SCALE,
): boolean {
  const [int = '', frac = ''] = plain.replace(/^[+-]/, '').split('.');
  const intDigits = int.replace(/^0+/, '').length;
  return intDigits <= precision - scale && frac.length <= scale;
}
