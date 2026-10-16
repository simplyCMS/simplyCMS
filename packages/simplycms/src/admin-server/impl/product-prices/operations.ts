import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { ValidationError } from 'simplycms/contracts/domain-errors';
import { defineOperation } from 'simplycms/operations';
import { saveProductPrices, saveProductPricesInput } from './save';

/**
 * `products.savePrices` (Р14): тонка команда над ядром `saveProductPrices` —
 * ціни не належать агрегату опису, тож `version` не збільшують і `If-Match`
 * не вимагають. Без блокування рядка товару: порядок локів вітрини (залишки
 * раніше за товар) інакше дав би дедлок; серіалізує ціль advisory-замок ядра.
 */
export const productsSavePrices = defineOperation({
  id: 'products.savePrices',
  permission: 'catalog.write',
  input: saveProductPricesInput,
  output: z.object({
    count: z.number().int(),
    removedIds: z.array(z.uuid()),
  }),
  async run({ db }, input) {
    // FK окремі (товар, модифікація): без звірки відкрилась би пара «товар A +
    // модифікація B». `saveStock` такого не має: ціль — товар АБО модифікація.
    if (input.modificationId) {
      const own = await db.execute(
        sql`select 1 from public.product_modifications
             where id = ${input.modificationId} and product_id = ${input.productId}`,
      );
      if (own.rows.length === 0)
        throw new ValidationError([
          { path: ['modificationId'], code: 'invalid_value' },
        ]);
    }
    const { rows, removedIds } = await saveProductPrices(db, input);
    return { count: rows.length, removedIds };
  },
});
