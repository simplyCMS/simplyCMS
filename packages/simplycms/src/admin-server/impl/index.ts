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
export { AdminConflictError, ValidationError } from './errors';
export { adminInput } from './validation';
export { reviewContentInput, getReviewContentOp } from './reviews/content';
