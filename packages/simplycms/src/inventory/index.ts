/**
 * 🔴 Server-only (contracts/server-only): спільний облік залишків для
 * вітрини (резерв/повернення замовлення) і адмінки (ручний облік, зміна
 * статусу замовлення). Одна копія гварду stock_status — рішення Е3-5;
 * облік замовлення переїхав сюди зі `storefront/loaders` — рішення Е5-3.
 */
export { loadTargetStatus, setTargetStatus } from './stock-status';
export type { StockTarget } from './stock-status';
export { syncStatusWithQuantity } from './quantity-status';
// М1 (рев'ю хвилі B): `lockTargetStock`/`servingQuantity` — одна копія
// предиката «обслуговуюча точка» для вітрини Й адмінки (`admin-server/impl/stock/save.ts`).
export { lockTargetStock, servingQuantity } from './locked-stock';
export type { LockedStockRow } from './locked-stock';
// Е5-3: облік замовлення — оформлення (вітрина), скасування (вітрина й адмінка).
export {
  loadStockManagement,
  releaseOrderStock,
  reserveOrderStock,
} from './order-stock';
export { InsufficientStockError } from './stock-reservation';
export type { StockLine } from './stock-write';
