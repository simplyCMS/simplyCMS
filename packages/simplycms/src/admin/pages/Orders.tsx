// Реекспорт: exports-мапа пакета несе `./admin/pages/*`, але не
// `./admin/features/*` — роут і надалі бере сторінку (та валідатор search)
// з цього шляху.
export { default } from '../features/orders/list/OrdersPage';
export { validateOrdersSearch } from '../features/orders/list/orders-search';
