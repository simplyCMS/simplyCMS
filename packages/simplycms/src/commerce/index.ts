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
export { quoteShippingCost, validateShippingChoice } from './shipping-choice';
export type {
  ShippingChoice,
  ShippingChoiceInput,
  ShippingChoiceRejection,
} from './shipping-choice';
export { loadDefaultPriceTypeId, loadPricesByProduct } from './pricing';
export {
  loadDefaultUserCategoryId,
  loadUserCategoryId,
  loadUserPriceTypeId,
} from './categories';
export { loadDiscountGroups } from './discounts';
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
export { loadPickupPoints } from './pickup-points';
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
export { toDiscount, toDiscountGroupNode } from './entities/discount';
export type {
  DiscountConditionRow,
  DiscountGroupRow,
  DiscountRow,
  DiscountTargetRow,
} from './entities/discount';
