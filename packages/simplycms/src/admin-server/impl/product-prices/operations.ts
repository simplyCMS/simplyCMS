import { z } from 'zod';
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
    const { rows, removedIds } = await saveProductPrices(db, input);
    return { count: rows.length, removedIds };
  },
});
