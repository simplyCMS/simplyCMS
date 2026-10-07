// Е6в-25, друга лінія (фінальне рев'ю, F4): рядки знижок, синтаксично
// валідні, але неможливі через `saveDiscount` (ціль без id, відсоток 150,
// відʼємна сума), вставлені SQL-ем, виключаються з розрахунку й лежать в
// `invalid` (у діагностиці — `discount_invalid`); валідна знижка діє.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadPricingContext, priceItems } from 'simplycms/commerce';
import { quoteCartFor } from 'simplycms/storefront/loaders';
import * as F from './fixtures/commerce';
import { guest, line, useCommerceDb } from './fixtures/commerce-db';
import { percentDiscountStatements } from './fixtures/discounts';

const PRODUCT = F.INVERTER_8KW;
const target = { type: 'product', id: PRODUCT } as const;
const BAD = ['Ціль без id −50%', 'Відсоток 150', 'Відʼємна сума'];

describe('семантично невалідні рядки знижок (Е6в-25, друга лінія)', () => {
  const db = useCommerceDb('simplycms_discount_semantics');
  beforeAll(async () => {
    await db.run(
      `update public.product_prices set price = 1000
        where product_id = '${PRODUCT}' and modification_id is null
          and price_type_id = (select id from public.price_types where code = 'retail')`,
    );
    const specs = [
      { group: 'Добра', name: 'Валідна −10%', percent: 10 },
      { group: 'Без id', name: BAD[0], percent: 50 },
      { group: 'Понад 100', name: BAD[1], percent: 150 },
      {
        group: 'Мінус',
        name: BAD[2],
        percent: -500,
        discountType: 'fixed_amount' as const,
      },
    ];
    for (const spec of specs)
      for (const s of percentDiscountStatements({ ...spec, target }))
        await db.run(s);
    // `modification` + NULL: колишній `matchesTarget` збігався з кожною
    // позицією без модифікації (`null === null`).
    await db.run(
      `update public.discount_targets set target_type = 'modification', target_id = null
        where discount_id = (select id from public.discounts where name = '${BAD[0]}')`,
    );
  });

  it('priceItems і квота кошика застосовують лише валідну знижку', async () => {
    const out = await guest((tx) => priceItems(tx, null, [line(PRODUCT)]));
    if (out === 'not_purchasable') throw new Error(out);
    expect(out[0].price).toBe(900);
    const quote = await quoteCartFor([line(PRODUCT)], null);
    const first = quote.lines[0];
    if (!first.available) throw new Error('недоступний');
    expect(first.price).toBe(900);
    expect(first.applied.map((a) => a.name)).toEqual(['Валідна −10%']);
  });

  it('невалідні — в invalid контексту (джерело discount_invalid діагностики), у лісі їх немає', async () => {
    const ctx = await guest((tx) =>
      loadPricingContext(tx, null, { includeInactive: true }),
    );
    expect(ctx.invalidDiscounts.map((r) => r.name).sort()).toEqual(
      [...BAD].sort(),
    );
    expect(ctx.invalidDiscounts.every((r) => r.kind === 'discount')).toBe(true);
    const names = ctx.forest.flatMap((g) => g.discounts.map((d) => d.name));
    expect(names).toContain('Валідна −10%');
    for (const name of BAD) expect(names).not.toContain(name);
  });
});
