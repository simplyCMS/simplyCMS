import type { ActorDb } from 'simplycms/db';
import { setTargetStatus, type StockTarget } from './stock-status';

/**
 * Статус цілі за фактичною сумою залишку — для ручного обліку адмінки
 * (Е3-3). Сам гвард живе в setTargetStatus: `on_order` не чіпається ніколи,
 * в `in_stock` піднімається лише з `out_of_stock`. Тобто ручне
 * `on_order` власника переживає будь-яке редагування кількості.
 */
export async function syncStatusWithQuantity(
  db: ActorDb,
  target: StockTarget,
  total: number,
): Promise<void> {
  // Дзеркало check-обмеження stock_product_or_modification: ціль без
  // жодного ключа — помилка викликача, а не «нічого не робити». Рядок
  // повідомлення — заодно сентинел dist-server-boundary (Task 2 Step 4).
  if (!target.productId && !target.modificationId)
    throw new Error(
      '[simplycms/inventory] ціль залишку без товару й модифікації',
    );
  await setTargetStatus(db, target, total > 0 ? 'in_stock' : 'out_of_stock');
}
