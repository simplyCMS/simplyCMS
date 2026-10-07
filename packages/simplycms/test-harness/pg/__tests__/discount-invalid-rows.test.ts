// Е6в-25: пошкоджений рядок знижки (рік 10000 у `ends_at`, вставлений SQL-ем
// в обхід `saveDiscount`) не ламає ціни магазину — валідна знижка поруч діє,
// а діагностика бачить виключений рядок в `invalid`.
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadPricingContext, priceItems } from 'simplycms/commerce';
import { quoteCartFor } from 'simplycms/storefront/loaders';
import * as F from './fixtures/commerce';
import { guest, line, useCommerceDb } from './fixtures/commerce-db';
import { percentDiscountStatements } from './fixtures/discounts';

const PRODUCT = F.INVERTER_8KW;
const target = { type: 'product', id: PRODUCT } as const;

describe('пошкоджений рядок правил знижок не ламає ціни', () => {
  const db = useCommerceDb('simplycms_discount_invalid');
  beforeAll(async () => {
    await db.run(
      `update public.product_prices set price = 1000
        where product_id = '${PRODUCT}' and modification_id is null
          and price_type_id = (select id from public.price_types where code = 'retail')`,
    );
  });
  beforeEach(async () => {
    await db.run('delete from public.discount_groups');
    for (const s of [
      ...percentDiscountStatements({
        group: 'Добра',
        name: 'Валідна −10%',
        percent: 10,
        target,
      }),
      ...percentDiscountStatements({
        group: 'Зіпсована',
        name: 'Зіпсована −50%',
        percent: 50,
        target,
      }),
    ])
      await db.run(s);
    // Рік 10000: Postgres його зберігає, а `new Date()` JS не розбирає.
    await db.run(
      `update public.discounts set ends_at = '10000-01-01 00:00:00+00' where name = 'Зіпсована −50%'`,
    );
  });

  it('priceItems і quoteCartFor застосовують валідну знижку без винятку', async () => {
    const out = await guest((tx) => priceItems(tx, null, [line(PRODUCT)]));
    if (out === 'not_purchasable') throw new Error(out);
    expect(out[0].price).toBe(900);
    const cart = await quoteCartFor([line(PRODUCT)], null);
    const first = cart.lines[0];
    if (!first.available) throw new Error('недоступний');
    expect(first.price).toBe(900);
  });

  it('includeInactive: невалідна знижка в invalid, у лісі її немає', async () => {
    const ctx = await guest((tx) =>
      loadPricingContext(tx, null, { includeInactive: true }),
    );
    expect(ctx.invalidDiscounts).toMatchObject([
      { name: 'Зіпсована −50%', groupName: 'Зіпсована', kind: 'discount' },
    ]);
    const names = ctx.forest.flatMap((g) => g.discounts.map((d) => d.name));
    expect(names).toEqual(['Валідна −10%']);
  });
});
