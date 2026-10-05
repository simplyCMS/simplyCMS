// Тема 12: константи клієнтського поля числової властивості мусять збігатися з
// колонкою (клієнтська тека не імпортує схему — звірка тут, у `tests/`).
import { describe, expect, it } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import { productPropertyValues } from 'simplycms/schema';
import {
  NUMERIC_VALUE_PRECISION,
  NUMERIC_VALUE_SCALE,
} from 'simplycms/admin/features/products/properties/number-format';

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
