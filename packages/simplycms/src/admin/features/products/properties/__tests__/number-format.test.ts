import { describe, expect, it } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import { productPropertyValues } from 'simplycms/schema';
import {
  NUMERIC_VALUE_PRECISION,
  NUMERIC_VALUE_SCALE,
  fitsNumeric,
  toPlainDecimal,
} from '../number-format';

describe('toPlainDecimal', () => {
  it.each([
    ['15', '15'],
    ['1.50', '1.5'],
    ['1e-7', '0.0000001'],
    ['1E-7', '0.0000001'],
    ['1.5e3', '1500'],
    ['2e0', '2'],
    ['.5', '0.5'],
    ['5.', '5'],
    ['-0', '0'],
    ['-0.0', '0'],
    ['-12.340', '-12.34'],
    ['00012', '12'],
    ['+3', '3'],
    ['1234e-2', '12.34'],
  ])('%s → %s', (raw, plain) => expect(toPlainDecimal(raw)).toBe(plain));

  it.each(['', 'abc', '.', 'e5', '1e', '1.2.3', '1e999', '--1', 'NaN'])(
    '%j → не число',
    (raw) => expect(toPlainDecimal(raw)).toBeNull(),
  );

  it('ніколи не повертає експоненту', () => {
    for (const raw of ['1e-7', '1e20', '5e-300', '123456789e-20'])
      expect(toPlainDecimal(raw)).not.toMatch(/e/i);
  });
});

describe('fitsNumeric (numeric(15,4))', () => {
  it('4 дробові так, 5 ні; 11 цілих так, 12 ні', () => {
    expect(fitsNumeric('0.0001')).toBe(true);
    expect(fitsNumeric('0.00001')).toBe(false);
    expect(fitsNumeric('99999999999.9999')).toBe(true);
    expect(fitsNumeric('100000000000')).toBe(false);
  });
});

describe('константи збігаються з колонкою product_property_values.numeric_value', () => {
  it('precision і scale', () => {
    const col = getTableColumns(productPropertyValues)
      .numericValue as unknown as {
      precision: number;
      scale: number;
    };
    expect(col.precision).toBe(NUMERIC_VALUE_PRECISION);
    expect(col.scale).toBe(NUMERIC_VALUE_SCALE);
  });
});
