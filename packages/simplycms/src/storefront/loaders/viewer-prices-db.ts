import {
  loadViewerPriceTypes,
  type ViewerPriceTypes,
} from 'simplycms/commerce';
import { withCustomerDb, withStorefrontDb, type ActorDb } from './db';

/**
 * Транзакція з набором видів цін глядача для ЗАДАНОГО `userId` — ядро
 * `withViewerDb` без читання сесії.
 *
 * 🔴 Свідомо поза публічним барелем (`./index`): функція приймає ідентичність
 * від викликача, а на вітрині її дозволено брати лише з серверної сесії.
 * Магазин і serverFn ходять через `withViewerDb`; сюди напряму імпортують
 * лише `./viewer` і харнес (`test-harness/pg`). Покупець читає під власним
 * актором: персональну категорію RLS віддає тільки власнику профілю.
 */
export function withViewerPricesDb<T>(
  userId: string | null,
  fn: (db: ActorDb, viewer: ViewerPriceTypes) => Promise<T>,
): Promise<T> {
  const load = async (db: ActorDb) =>
    fn(db, await loadViewerPriceTypes(db, userId));
  return userId
    ? withCustomerDb(userId, (db) => load(db))
    : withStorefrontDb(load);
}
