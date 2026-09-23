/**
 * 🔴 Server-only (contracts/server-only): спільний облік залишків для
 * вітрини (резерв/повернення замовлення) і адмінки (ручний облік). Одна
 * копія гварду stock_status — рішення Е3-5.
 */
export { loadTargetStatus, setTargetStatus } from './stock-status';
export type { StockTarget } from './stock-status';
export { syncStatusWithQuantity } from './quantity-status';
