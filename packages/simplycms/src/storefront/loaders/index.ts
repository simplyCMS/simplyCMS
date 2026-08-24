export * from './db';
export * from './session';
export * from './banners';
export * from './categories';
export * from './discounts';
export * from './home';
export * from './home-sections';
export * from './pricing';
export * from './catalog-filters';
export * from './catalog-products';
export * from './modification-values';
export * from './order-create';
export * from './order-statuses';
export * from './orders';
export * from './addresses';
export * from './pickup-points';
export * from './profile';
export * from './recipients';
export * from './reviews';
export * from './reviews-write';
export * from './stock';
export * from './stock-info';
export * from './product-detail';
export * from './products';
export * from './properties';
export * from './property-option';
export * from './property-values';
export * from './sections';
export * from './shipping';
export * from './sitemap';
// 🔴 Мапи колонок (`*Columns`) назовні НЕ виходять — це внутрішні помічники
// побудови select-ів, а не публічний API. Причина не лише в чистоті межі:
// їхні значення — Drizzle-колонки з глибоко генеричними типами, і `export *`
// затягував увесь типовий граф ORM у публічний `.d.ts` пакета. Генерація
// декларацій на цьому вичерпувала heap воркера tsup
// (`ERR_WORKER_OUT_OF_MEMORY`) — тобто збірка падала не від обсягу коду, а
// від того, що внутрішній інструмент протік у контракт. Назовні — рядки й мапери.
export type {
  CatalogModificationRow,
  CatalogPropertyValueRow,
  CatalogProductRow,
} from './entities/catalog-product';
export {
  pickDefaultModification,
  toNumericValue,
} from './entities/catalog-product';
export type {
  DiscountGroupRow,
  DiscountRow,
  DiscountTargetRow,
  DiscountConditionRow,
} from './entities/discount';
export { toDiscountGroupNode, toDiscount } from './entities/discount';
export type {
  OrderStatusRow,
  OrderItemRow,
  OrderListRow,
  OrderDetailRow,
  RawOrderItem,
} from './entities/order';
export { toOrderItem, groupItemsByOrder } from './entities/order';
export { toBanner, isBannerVisible } from './entities/banner';
export type {
  HomeProductRow,
  RawHomeProductRow,
} from './entities/home-product';
export { toHomeProduct } from './entities/home-product';
export type { ModificationRow } from './entities/modification';
export { toModificationRow } from './entities/modification';
export type { RawPriceRow } from './entities/price';
export { toPriceEntry, groupPricesByProduct } from './entities/price';
export type { ProductRow } from './entities/product';
export { toImageList } from './entities/product';
export type { JsonValue, PropertyRow, OptionRow } from './entities/property';
export { toPropertyRow } from './entities/property';
export type { SectionRow, SectionRef } from './entities/section';
