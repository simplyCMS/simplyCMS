import { z } from 'zod';
import { STOCK_MANAGEMENT_KEY } from 'simplycms/contracts/store-profile';
import { systemSettings } from 'simplycms/schema';
import { runAdmin } from '../run';
import { parseAdminInput } from '../validation';

export const saveStockManagementInput = z.object({
  decreaseOnOrder: z.boolean(),
});

/**
 * Перемикач обліку залишків (Е6б-21): пише `value.decrease_on_order`, який
 * читає `loadStockManagement` на оформленні замовлення. Окрема операція від
 * профілю: перемикач зберігається одразу, профіль — кнопкою форми.
 *
 * Upsert, а не UPDATE: рядок могли прибрати ручним SQL, а «перемикач
 * мовчки нічого не зберіг» гірше за відтворений рядок (`id` — від викликача).
 * Кеш вітрини не скидається: облік читається щоразу в транзакції замовлення.
 */
export const saveStockManagementOp = async ({
  data,
}: {
  data: z.input<typeof saveStockManagementInput>;
}): Promise<{ decreaseOnOrder: boolean }> => {
  const { decreaseOnOrder } = parseAdminInput(saveStockManagementInput, data);
  return runAdmin('settings.manage', async (db) => {
    const value = { decrease_on_order: decreaseOnOrder };
    await db
      .insert(systemSettings)
      .values({ id: crypto.randomUUID(), key: STOCK_MANAGEMENT_KEY, value })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value, updatedAt: new Date() },
      });
    return { decreaseOnOrder };
  });
};
