// Реекспорт (Task 6, рішення архітектора 2026-09-23): exports-мапа пакета
// несе `./admin/pages/*`, але не `./admin/features/*` — новий субшлях не
// заводимо, роут і надалі бере сторінку з цього шляху.
export { default } from '../features/products/list/ProductsPage';
