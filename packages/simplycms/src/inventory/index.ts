/**
 * 🔴 Server-only (contracts/server-only): спільний облік залишків для
 * вітрини (резерв/повернення замовлення) і адмінки (ручний облік, зміна
 * статусу замовлення). Одна копія гварду stock_status; облік замовлення
 * переїхав сюди зі `storefront/loaders`.
 */
export { loadTargetStatus, setTargetStatus } from './stock-status';
export type { StockTarget } from './stock-status';
export { syncStatusWithQuantity } from './quantity-status';
// М1 (рев'ю хвилі B): `lockTargetStock`/`servingQuantity` — одна копія
// предиката «обслуговуюча точка» для вітрини Й адмінки (`admin-server/impl/stock/save.ts`).
export { lockTargetStock, servingQuantity } from './locked-stock';
export type { LockedStockRow } from './locked-stock';
// Облік замовлення — оформлення (вітрина), скасування (вітрина й адмінка).
export {
  loadStockManagement,
  releaseOrderStock,
  reserveOrderStock,
} from './order-stock';
// Дельта залишку по одній позиції — редагування позицій в адмінці.
export {
  adjustOrderItemStock,
  reserveNewOrderItemStock,
} from './order-item-stock';
export { releaseOrderItemStock } from './order-item-release';
export { InsufficientStockError } from './stock-reservation';
export type { StockLine } from './stock-write';
