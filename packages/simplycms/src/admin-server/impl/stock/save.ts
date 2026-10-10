import { z } from 'zod';
import { runAdmin } from '../run';
import { parseAdminInput } from '../validation';
import { saveStock } from './save-core';

export const saveStockInput = z
  .object({
    productId: z.uuid().nullable(),
    modificationId: z.uuid().nullable(),
    quantities: z
      .array(
        z.object({
          pickupPointId: z.uuid(),
          // Бізнес-ліміт 1 000 000 шт. на точку (не int32-обмеження колонки):
          // відсікає друкарську помилку (зайвий нуль) вже на межі, 400, не 500.
          quantity: z.number().int().min(0).max(1_000_000),
        }),
      )
      // М2: порожній набір — 400 на межі, а не мовчазний no-op (нічого не
      // писати й нічого не перерахувати не є валідним викликом «Зберегти»).
      .min(1)
      .max(200),
  })
  // Рівно одна ціль — дзеркало check-обмеження stock_product_or_modification.
  .refine((d) => (d.productId === null) !== (d.modificationId === null), {
    message: 'потрібна рівно одна ціль: товар АБО модифікація',
  });

export type SaveStockInput = z.output<typeof saveStockInput>;

/**
 * Ручний облік (Е3-3) — операція: парс ДО гранта (400 до `requireGrant`) →
 * ядро `saveStock` (`./save-core`, там канон локів М2) у транзакції гранта.
 */
export const saveStockOp = async ({ data }: { data: SaveStockInput }) => {
  const input = parseAdminInput(saveStockInput, data);
  return runAdmin('catalog.write', (db) => saveStock(db, input));
};
