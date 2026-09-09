// Pure-розрахунок наявності перенесено в simplycms/domain/inventory.
//
// 🔴 Fetch-хелпери (`fetchModificationPropertyValues`, `fetchModificationStockData`)
// ЗНЕСЕНО разом із контуром PostgREST: залишки й характеристики модифікацій
// тепер рахує сервер (`storefront/loaders/stock`, `modification-values`), а
// складські рядки по точках видачі в браузер більше не їдуть узагалі.
export {
  calculateProductAvailability,
  enrichProductsWithAvailability,
} from 'simplycms/domain/inventory';
export type { StockData } from 'simplycms/domain/inventory';
