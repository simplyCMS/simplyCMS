import type { StoreProfile } from 'simplycms/contracts/store-profile';
import { loadStockManagement } from 'simplycms/inventory';
import { readStoreProfile } from 'simplycms/site';
import { runAdmin } from '../run';

export type SystemSettings = {
  profile: StoreProfile;
  stockManagement: { decreaseOnOrder: boolean };
};

/**
 * Системні налаштування для форми адмінки (Е6б-21).
 *
 * 🔴 Обидва читачі — ТІ САМІ, що й у споживачів: профіль розбирає
 * `readStoreProfile` (як вітрина), облік — `loadStockManagement` (як
 * оформлення замовлення). Власний розбір тут дав би друге правило, і форма
 * показала б не те, що бачить магазин. Зіпсований чи відсутній рядок →
 * порожній профіль: форма відкривається, і збереження відтворює рядок.
 */
export const getSystemSettingsOp = async (): Promise<SystemSettings> =>
  runAdmin('settings.manage', async (db) => {
    const profile = await readStoreProfile(db);
    const { decrease_on_order } = await loadStockManagement(db);
    return { profile, stockManagement: { decreaseOnOrder: decrease_on_order } };
  });
