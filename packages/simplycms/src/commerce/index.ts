/**
 * 🔴 Server-only (contracts/server-only): серверне ціноутворення й доставка,
 * спільні для чекауту вітрини (`storefront/loaders/prepare-checkout`) і
 * адмінки (редагування позицій замовлення, К3-Е5б). Переїхало зі
 * `storefront/loaders` рішенням Е5б-5: `admin-server` не сміє імпортувати
 * лоадери вітрини (тір-зони), а друга копія рушія — це вже пройдений дефект
 * розходження знижок (B2/r1). Реекспорту зі `storefront/loaders` немає.
 *
 * Усередині теки імпорти — прямі сусідні (`./pricing`), не через цей барель.
 */
export { priceItems } from './price-items';
export type { NewOrderItem } from './price-items';
export { priceCart } from './price-cart';
export type { PricedLine, UnavailableLine } from './price-cart';
export { loadPricingContext } from './pricing-context';
export type { PricingContext } from './pricing-context';
export { loadDiscountRules, parseDiscountRules } from './discount-rules';
export { quoteShippingCost, validateShippingChoice } from './shipping-choice';
export type {
  ShippingChoice,
  ShippingChoiceInput,
  ShippingChoiceRejection,
} from './shipping-choice';
export { loadDefaultPriceTypeId, loadPricesByProduct } from './pricing';
export { loadGuestPriceTypes, resolvePriceTypes } from './price-types';
export type { PriceTypes } from './price-types';
export {
  loadCategoryPriceTypeId,
  loadDefaultUserCategoryId,
  loadUserCategoryId,
} from './categories';
// Категорії покупців і автоправила (Е6в-15, Е6в-19, Е6в-20): спільні для
// вітрини (після COMMIT замовлення) і адмінки (кнопка, ручне призначення).
export {
  applyCategoryRules,
  customerCategoryLock,
  writeCategoryChange,
} from './customer-categories';
export type {
  CategoryChange,
  CategoryRulesOutcome,
} from './customer-categories';
export { loadCustomerStats } from './customer-stats';
export {
  loadShippingDirectory,
  loadShippingMethods,
  loadShippingRates,
  loadShippingZones,
} from './shipping-directory';
export type {
  ShippingDirectory,
  ShippingMethodRow,
  ShippingRateRow,
  ShippingZoneRow,
} from './shipping-types';
export { resolveDestination } from './shipping-providers';
export type {
  DestinationInput,
  DestinationRejection,
  ResolvedDestination,
} from './shipping-providers';
export { loadPickupPoint, loadPickupPoints } from './pickup-points';
export type { PickupPointRow } from './pickup-points';
// Мапа колонок ціни — виняток із правила «`*Columns` назовні не виходять»
// (`storefront/loaders/index.ts`): три лоадери вітрини (каталог, список,
// картка) будують власні select-и цін з іншими предикатами, а теки тепер
// різні, тож спільна мапа може прийти лише через барель.
export {
  groupPricesByProduct,
  priceColumns,
  toPriceEntry,
} from './entities/price';
export type { RawPriceRow } from './entities/price';
