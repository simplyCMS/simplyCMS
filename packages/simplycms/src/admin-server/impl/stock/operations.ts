import { z } from 'zod';
import { defineOperation } from 'simplycms/operations';
import { saveStockInput } from './save';
import { saveStock } from './save-core';

/**
 * `products.saveStock` (Р14): тонка команда над ядром `saveStock` (ручний облік
 * + гвардований перехід `stock_status`). `version` не збільшує: залишки не
 * належать агрегату опису. Рядок товару не блокує — порядок локів задає ядро.
 */
export const productsSaveStock = defineOperation({
  id: 'products.saveStock',
  permission: 'catalog.write',
  input: saveStockInput,
  output: z.object({
    count: z.number().int(),
    stockStatus: z.enum(['in_stock', 'out_of_stock', 'on_order']),
  }),
  async run({ db }, input) {
    const { rows, target } = await saveStock(db, input);
    return { count: rows.length, stockStatus: target.stockStatus };
  },
});
