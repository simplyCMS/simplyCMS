/**
 * 🔴 Server-only барель нутрощів — ДЗЕРКАЛО механіки
 * `storefront-routes/server/*` ↔ `storefront/loaders`: index.ts імпортує
 * звідси BARE-специфікатором `simplycms/admin-server/impl`, бандлер лишає
 * його зовнішнім (`deps.neverBundle`), тож у dist це ОКРЕМИЙ модуль. Саме на
 * цьому тримається розрізнювальна здатність Gate C: нетрансформований index
 * тягне impl — і payload-маркер червоніє; трансформований стаб імпорту не
 * має (DCE). Однаковий префікс id стаба й нутрощів такої здатності не дає —
 * це знахідка рев'ю ред.2.
 */
export { orderStatusesOps } from './order-statuses/resource';
export {
  setDefaultInput,
  setDefaultOrderStatusOp,
} from './order-statuses/set-default';
export { reorderInput, reorderOrderStatusOp } from './order-statuses/reorder';
export {
  removeStatusInput,
  removeManyInput,
  removeManyOrderStatusesOp,
} from './order-statuses/remove';
export {
  deleteMediaInput,
  deleteMediaOp,
  parseUploadForm,
  uploadMediaOp,
  uploadFormInput,
} from './media/operations';
export type { ParsedUpload } from './media/operations';
export type { SubsetInput, SubsetPayload } from './subset';
export { productsOps } from './products/resource';
export { productModificationsOps } from './product-modifications/resource';
export {
  setDefaultModificationInput,
  setDefaultModificationOp,
} from './product-modifications/set-default';
export {
  reorderModificationInput,
  reorderModificationOp,
} from './product-modifications/reorder';
export { productPricesOps } from './product-prices/resource';
export {
  saveProductPricesInput,
  saveProductPricesOp,
} from './product-prices/save';
export { stockOps } from './stock/resource';
export { saveStockInput, saveStockOp } from './stock/save';
export {
  productPropertyValuesOps,
  modificationPropertyValuesOps,
} from './property-values/resources';
export { sectionsOps } from './sections/resource';
export { priceTypesOps } from './price-types/resource';
export {
  setDefaultPriceTypeInput,
  setDefaultPriceTypeOp,
} from './price-types/set-default';
export {
  removePriceTypesInput,
  removeManyPriceTypesOp,
} from './price-types/remove';
export { sectionPropertiesOps } from './section-properties/resource';
export { propertyOptionsOps } from './property-options/resource';
export { sectionPropertyAssignmentsOps } from './section-property-assignments/resource';
export { ordersOps } from './orders/resource';
export type { OrderRow } from './orders/resource';
export { orderItemsOps } from './order-items/resource';
export {
  changeOrderStatusInput,
  changeOrderStatusOp,
} from './orders/change-status';
export { addOrderItemInput, addOrderItemOp } from './order-items/add';
export {
  updateOrderItemQuantityInput,
  updateOrderItemQuantityOp,
} from './order-items/update-quantity';
export { removeOrderItemInput, removeOrderItemOp } from './order-items/remove';
export type {
  OrderItemRow,
  OrderItemsEditResult,
} from './order-items/editable';
export {
  searchProductsForOrderInput,
  searchProductsForOrderOp,
} from './products/search-for-order';
export type { OrderProductHit } from './products/search-for-order';
export { shippingMethodsOps } from './shipping-methods/resource';
export {
  removeShippingMethodsInput,
  removeShippingMethodsOp,
} from './shipping-methods/remove';
export { shippingZonesOps } from './shipping-zones/resource';
export {
  setDefaultShippingZoneInput,
  setDefaultShippingZoneOp,
} from './shipping-zones/set-default';
export {
  removeShippingZonesInput,
  removeShippingZonesOp,
} from './shipping-zones/remove';
export { shippingRatesOps } from './shipping-rates/resource';
export { pickupPointsOps } from './pickup-points/resource';
export {
  removePickupPointsInput,
  removePickupPointsOp,
} from './pickup-points/remove';
export { getSystemSettingsOp } from './settings/get';
export type { SystemSettings } from './settings/get';
export { storeProfileInput } from './settings/profile-schema';
export { saveStoreProfileOp } from './settings/save-profile';
export {
  saveStockManagementInput,
  saveStockManagementOp,
} from './settings/save-stock';
// 🔴 Теки `site-*`, а не `themes`/`plugins` (Е6б-26): відносний `../themes`
// тір-зона читає як теку тем T4 — збіг імен змусив би обходити правило барелем.
export { listThemesOp } from './site-themes/list';
export type { ThemeRow } from './site-themes/list';
export { activateThemeInput, activateThemeOp } from './site-themes/activate';
export {
  saveThemeSettingsInput,
  saveThemeSettingsOp,
} from './site-themes/save-settings';
export { listPluginsOp } from './site-plugins/list';
export type { PluginRow } from './site-plugins/list';
export {
  setPluginActiveInput,
  setPluginActiveOp,
} from './site-plugins/set-active';
// К3-Е6в, Task 5: знижки (`discount.manage`, Е6в-14..17).
export { discountGroupsOps } from './discount-groups/resource';
export {
  removeDiscountGroupsInput,
  removeDiscountGroupsOp,
} from './discount-groups/remove';
export { discountsOps } from './discounts/resource';
export { removeDiscountsInput, removeDiscountsOp } from './discounts/remove';
export { getDiscountInput, getDiscountOp } from './discounts/get';
export { saveDiscountInput } from './discounts/save-input';
export type { SaveDiscountInput } from './discounts/save-input';
export { saveDiscountOp } from './discounts/save';
export { DISCOUNT_CONFIG_LOCK } from './discount-lock';
export { CUSTOMER_CONFIG_LOCK } from './customer-lock';
// Харнес доводить, що `lockCatalogTarget` і `advisoryXactLock` — один лок (Е6в-15).
export { lockCatalogTarget } from './catalog-lock';
// К3-Е6в, Task 6: категорії покупців і автоправила (`customer.manage`,
// Е6в-15, Е6в-18…Е6в-20).
export { userCategoriesOps } from './user-categories/resource';
export {
  setDefaultUserCategoryInput,
  setDefaultUserCategoryOp,
} from './user-categories/set-default';
export {
  removeUserCategoriesInput,
  removeUserCategoriesOp,
} from './user-categories/remove';
export { countCustomersByCategoryOp } from './user-categories/counts';
export type { CategoryCustomerCount } from './user-categories/counts';
export { categoryRulesOps } from './category-rules/resource';
export {
  CATEGORY_RULES_BATCH,
  runCategoryRulesOp,
} from './category-rules/run-all';
export {
  assignCustomerCategoryInput,
  assignCustomerCategoryOp,
} from './customers/assign-category';
export { findCustomersInput, findCustomersOp } from './customers/find';
export type { CustomerHit } from './customers/find';
export { AdminConflictError, ValidationError } from './errors';
export { adminInput } from './validation';
export { reviewContentInput, getReviewContentOp } from './reviews/content';
export { diagnosePriceInput } from './price-diagnosis/input';
export { diagnosePriceOp } from './price-diagnosis/diagnose';
export type { PriceDiagnosis } from './price-diagnosis/diagnose';

// К3-Е6г, Task 3: читання покупців і дашборду.
export {
  CUSTOMERS_PAGE_SIZE,
  listCustomersInput,
  listCustomersOp,
} from './customers/list';
export { getCustomerCardInput, getCustomerCardOp } from './customers/card';
export { dashboardSummaryOp } from './dashboard/summary';
export { setAdminRoleInput, setAdminRoleOp } from './customers/roles';
export { countAdmins, isAdminUser } from './customers/guards';
