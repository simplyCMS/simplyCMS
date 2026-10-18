// М1 Task 17 fix-1 (M9): формат кольору значення має ДВА носії — zod-регекс вводу команди
// (`propertyValueUpsert.color`, `children-schemas.ts`) і CHECK `*_color_format` у схемі.
// Один набір векторів проти обох: TS-схемою і справжньою вставкою значення (CHECK за
// іменем, а не копія виразу). Розбіжність дала б 500 замість 400 або 400 на коді, який БД
// прийняла б.
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { isCheckViolation } from 'simplycms/db';
import { propertyValueUpsert } from '../../../src/admin-server/impl/products/aggregate/children-schemas';
import { useAddressingDb } from './fixtures/addressing-db';
import { valueSql } from './fixtures/product-graph';

const VALID = ['#000000', '#ffffff', '#a1b2c3'];
const INVALID = ['#A1B2C3', 'a1b2c3', '#abc', '#abcdeg', '#a1b2c3d', 'red', ''];

describe('парність формату кольору: zod вводу ↔ CHECK product_property_values_color_format', () => {
  const db = useAddressingDb('simplycms_color_format_parity');
  let product = '';
  beforeAll(async () => {
    product = await db.product();
  });

  /** Чи приймає колір CHECK схеми; власна властивість — бо скаляр один на власника (І8). */
  const dbAccepts = async (color: string): Promise<boolean> => {
    const property = randomUUID();
    await db.q(
      `insert into public.section_properties (id, name, slug, property_type)
       values ($1, $2, $3, 'color')`,
      [property, `c-${property}`, `c-${property}`],
    );
    try {
      await db.tx(
        ...valueSql(
          { kind: 'product', id: product },
          { id: randomUUID(), propertyId: property, kind: 'color', color },
        ),
      );
      return true;
    } catch (error) {
      if (isCheckViolation(error, 'product_property_values_color_format'))
        return false;
      throw error;
    }
  };
  const tsAccepts = (color: string) =>
    propertyValueUpsert.shape.color.safeParse(color).success;

  it.each([...VALID.map((c) => [c, true]), ...INVALID.map((c) => [c, false])])(
    '%j: обидва носії дають %s',
    async (color, valid) => {
      expect(tsAccepts(color as string)).toBe(valid);
      expect(await dbAccepts(color as string)).toBe(valid);
    },
  );
});
