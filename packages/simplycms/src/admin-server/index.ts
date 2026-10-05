import { createServerFn } from '@tanstack/react-start';
// 🔴 BARE-специфікатор, не './impl': відносний імпорт бандлер заінлайнив би,
// і розрізнення «стаб vs нетрансформований» у dist зникло б (див. impl/).
// Стереже правило server-only-relative.
import {
  deleteMediaInput,
  deleteMediaOp,
  uploadMediaOp,
  orderStatusesOps,
  setDefaultInput,
  setDefaultOrderStatusOp,
  reorderInput,
  reorderOrderStatusOp,
  removeManyInput,
  removeManyOrderStatusesOp,
  productsOps,
  productModificationsOps,
  setDefaultModificationInput,
  setDefaultModificationOp,
  reorderModificationInput,
  reorderModificationOp,
  productPricesOps,
  saveProductPricesInput,
  saveProductPricesOp,
  stockOps,
  saveStockInput,
  saveStockOp,
  productPropertyValuesOps,
  modificationPropertyValuesOps,
  sectionsOps,
  priceTypesOps,
  setDefaultPriceTypeInput,
  setDefaultPriceTypeOp,
  removePriceTypesInput,
  removeManyPriceTypesOp,
  sectionPropertyAssignmentsOps,
  sectionPropertiesOps,
  propertyOptionsOps,
  ordersOps,
  orderItemsOps,
  changeOrderStatusInput,
  changeOrderStatusOp,
  addOrderItemInput,
  addOrderItemOp,
  updateOrderItemQuantityInput,
  updateOrderItemQuantityOp,
  removeOrderItemInput,
  removeOrderItemOp,
  searchProductsForOrderInput,
  searchProductsForOrderOp,
  reviewContentInput,
  getReviewContentOp,
} from 'simplycms/admin-server/impl';

/**
 * 🔴 Публічна поверхня admin-server: ЛИШЕ serverFn (К3-9′ п.1). Жодного
 * живого не-serverFn експорту: клієнтська трансформація Start вирізає
 * validator і handler та чистить осиротілі імпорти DCE-проходом —
 * але лише доки їх не тримає інший живий експорт. Схеми/операції назовні
 * НЕ реекспортуються.
 */
export const listOrderStatuses = createServerFn({ method: 'GET' })
  .validator(orderStatusesOps.subsetSchema)
  .handler(orderStatusesOps.list);

export const insertOrderStatuses = createServerFn({ method: 'POST' })
  .validator(orderStatusesOps.insertSchema)
  .handler(orderStatusesOps.insert);

export const updateOrderStatuses = createServerFn({ method: 'POST' })
  .validator(orderStatusesOps.updateSchema)
  .handler(orderStatusesOps.update);

// 🔴 remove ЦІЄЇ сутності — guarded-операція, не фабричний ops.remove:
// «не видалити дефолтний» — доменний інваріант (критерій К3-4′).
export const removeOrderStatuses = createServerFn({ method: 'POST' })
  .validator(removeManyInput)
  .handler(removeManyOrderStatusesOp);

export const setDefaultOrderStatus = createServerFn({ method: 'POST' })
  .validator(setDefaultInput)
  .handler(setDefaultOrderStatusOp);

export const reorderOrderStatus = createServerFn({ method: 'POST' })
  .validator(reorderInput)
  .handler(reorderOrderStatusOp);

// 🔴 Валідатор — функція, а не Zod-схема: `validator` зі схемою не
// приймає FormData (Start типізує цю гілку окремо). Вміст форми перевіряє
// `parseUploadForm` усередині операції.
export const uploadMedia = createServerFn({ method: 'POST' })
  .validator((data: unknown): FormData => {
    if (!(data instanceof FormData)) {
      throw new Error('[simplycms] uploadMedia expects FormData.');
    }
    return data;
  })
  .handler(uploadMediaOp);

export const deleteMedia = createServerFn({ method: 'POST' })
  .validator(deleteMediaInput)
  .handler(deleteMediaOp);

// 🔴 Task 3 (Е3): файл переростає канон 150 рядків СВІДОМО — К3-9′ вимагає
// ЄДИНОГО модуля serverFn, і розбиття його на кілька змінило б межу, яку
// стереже Gate C (стаб-маркер dist/admin-server/index). Кожен serverFn —
// топ-рівневий const (гейт server-fn-top-level).

export const listProducts = createServerFn({ method: 'GET' })
  .validator(productsOps.subsetSchema)
  .handler(productsOps.list);

export const insertProducts = createServerFn({ method: 'POST' })
  .validator(productsOps.insertSchema)
  .handler(productsOps.insert);

export const updateProducts = createServerFn({ method: 'POST' })
  .validator(productsOps.updateSchema)
  .handler(productsOps.update);

export const removeProducts = createServerFn({ method: 'POST' })
  .validator(productsOps.removeSchema)
  .handler(productsOps.remove);

export const listProductModifications = createServerFn({ method: 'GET' })
  .validator(productModificationsOps.subsetSchema)
  .handler(productModificationsOps.list);

export const insertProductModifications = createServerFn({ method: 'POST' })
  .validator(productModificationsOps.insertSchema)
  .handler(productModificationsOps.insert);

export const updateProductModifications = createServerFn({ method: 'POST' })
  .validator(productModificationsOps.updateSchema)
  .handler(productModificationsOps.update);

export const removeProductModifications = createServerFn({ method: 'POST' })
  .validator(productModificationsOps.removeSchema)
  .handler(productModificationsOps.remove);

// 🔴 Task 4 (Е3): дефолт і порядок модифікацій — iменовані операції, не
// фабричний insert/update (single-default індекс, контракт хвиль Е1б).
export const setDefaultProductModification = createServerFn({
  method: 'POST',
})
  .validator(setDefaultModificationInput)
  .handler(setDefaultModificationOp);

export const reorderProductModification = createServerFn({ method: 'POST' })
  .validator(reorderModificationInput)
  .handler(reorderModificationOp);

export const listProductPrices = createServerFn({ method: 'GET' })
  .validator(productPricesOps.subsetSchema)
  .handler(productPricesOps.list);

// 🔴 Атомарна заміна набору цін пари товар/модифікація (Е3-10) — не
// фабричні insert/update/remove: одна кнопка «Зберегти ціни», один акт.
export const saveProductPrices = createServerFn({ method: 'POST' })
  .validator(saveProductPricesInput)
  .handler(saveProductPricesOp);

export const listStock = createServerFn({ method: 'GET' })
  .validator(stockOps.subsetSchema)
  .handler(stockOps.list);

// 🔴 Ручний облік залишків з гвардованим переходом stock_status в ОДНІЙ
// транзакції (Е3-3) — не фабричний ops.update.
export const saveStock = createServerFn({ method: 'POST' })
  .validator(saveStockInput)
  .handler(saveStockOp);

export const listProductPropertyValues = createServerFn({ method: 'GET' })
  .validator(productPropertyValuesOps.subsetSchema)
  .handler(productPropertyValuesOps.list);

export const insertProductPropertyValues = createServerFn({ method: 'POST' })
  .validator(productPropertyValuesOps.insertSchema)
  .handler(productPropertyValuesOps.insert);

export const updateProductPropertyValues = createServerFn({ method: 'POST' })
  .validator(productPropertyValuesOps.updateSchema)
  .handler(productPropertyValuesOps.update);

export const removeProductPropertyValues = createServerFn({ method: 'POST' })
  .validator(productPropertyValuesOps.removeSchema)
  .handler(productPropertyValuesOps.remove);

export const listModificationPropertyValues = createServerFn({ method: 'GET' })
  .validator(modificationPropertyValuesOps.subsetSchema)
  .handler(modificationPropertyValuesOps.list);

export const insertModificationPropertyValues = createServerFn({
  method: 'POST',
})
  .validator(modificationPropertyValuesOps.insertSchema)
  .handler(modificationPropertyValuesOps.insert);

export const updateModificationPropertyValues = createServerFn({
  method: 'POST',
})
  .validator(modificationPropertyValuesOps.updateSchema)
  .handler(modificationPropertyValuesOps.update);

export const removeModificationPropertyValues = createServerFn({
  method: 'POST',
})
  .validator(modificationPropertyValuesOps.removeSchema)
  .handler(modificationPropertyValuesOps.remove);

// 🔴 Task 3 (Е4): довідники каталогу — записувані ресурси замість читальних
// Е3 (Е3-1 → Е4). Операція всього CRUD — catalog.write (Е3-6). Незмінні
// після створення колонки — insertOnly фабрики (Е4-5); slug/code перевіряє
// сервер (Е4-7). remove і setDefault типу ціни — іменовані (Task 4, Е4-2),
// фабричного remove для типів цін немає.

export const listSections = createServerFn({ method: 'GET' })
  .validator(sectionsOps.subsetSchema)
  .handler(sectionsOps.list);

export const insertSections = createServerFn({ method: 'POST' })
  .validator(sectionsOps.insertSchema)
  .handler(sectionsOps.insert);

export const updateSections = createServerFn({ method: 'POST' })
  .validator(sectionsOps.updateSchema)
  .handler(sectionsOps.update);

export const removeSections = createServerFn({ method: 'POST' })
  .validator(sectionsOps.removeSchema)
  .handler(sectionsOps.remove);

export const listPriceTypes = createServerFn({ method: 'GET' })
  .validator(priceTypesOps.subsetSchema)
  .handler(priceTypesOps.list);

export const insertPriceTypes = createServerFn({ method: 'POST' })
  .validator(priceTypesOps.insertSchema)
  .handler(priceTypesOps.insert);

export const updatePriceTypes = createServerFn({ method: 'POST' })
  .validator(priceTypesOps.updateSchema)
  .handler(priceTypesOps.update);

// 🔴 Task 4 (Е4-2): remove ЦІЄЇ сутності — guarded, не фабричний: «не
// видалити дефолтний» — доменний інваріант. Обидві операції серіалізує
// той самий advisory-lock `price-type-default`.
export const removePriceTypes = createServerFn({ method: 'POST' })
  .validator(removePriceTypesInput)
  .handler(removeManyPriceTypesOp);

export const setDefaultPriceType = createServerFn({ method: 'POST' })
  .validator(setDefaultPriceTypeInput)
  .handler(setDefaultPriceTypeOp);

export const listSectionProperties = createServerFn({ method: 'GET' })
  .validator(sectionPropertiesOps.subsetSchema)
  .handler(sectionPropertiesOps.list);

export const insertSectionProperties = createServerFn({ method: 'POST' })
  .validator(sectionPropertiesOps.insertSchema)
  .handler(sectionPropertiesOps.insert);

export const updateSectionProperties = createServerFn({ method: 'POST' })
  .validator(sectionPropertiesOps.updateSchema)
  .handler(sectionPropertiesOps.update);

export const removeSectionProperties = createServerFn({ method: 'POST' })
  .validator(sectionPropertiesOps.removeSchema)
  .handler(sectionPropertiesOps.remove);

export const listPropertyOptions = createServerFn({ method: 'GET' })
  .validator(propertyOptionsOps.subsetSchema)
  .handler(propertyOptionsOps.list);

export const insertPropertyOptions = createServerFn({ method: 'POST' })
  .validator(propertyOptionsOps.insertSchema)
  .handler(propertyOptionsOps.insert);

export const updatePropertyOptions = createServerFn({ method: 'POST' })
  .validator(propertyOptionsOps.updateSchema)
  .handler(propertyOptionsOps.update);

export const removePropertyOptions = createServerFn({ method: 'POST' })
  .validator(propertyOptionsOps.removeSchema)
  .handler(propertyOptionsOps.remove);

export const listSectionPropertyAssignments = createServerFn({
  method: 'GET',
})
  .validator(sectionPropertyAssignmentsOps.subsetSchema)
  .handler(sectionPropertyAssignmentsOps.list);

export const insertSectionPropertyAssignments = createServerFn({
  method: 'POST',
})
  .validator(sectionPropertyAssignmentsOps.insertSchema)
  .handler(sectionPropertyAssignmentsOps.insert);

export const updateSectionPropertyAssignments = createServerFn({
  method: 'POST',
})
  .validator(sectionPropertyAssignmentsOps.updateSchema)
  .handler(sectionPropertyAssignmentsOps.update);

export const removeSectionPropertyAssignments = createServerFn({
  method: 'POST',
})
  .validator(sectionPropertyAssignmentsOps.removeSchema)
  .handler(sectionPropertyAssignmentsOps.remove);

// 🔴 Task 4 (Е5): замовлення — лише читання через фабрику; зміна статусу —
// іменована операція (лок рядка → «скасоване — кінцеве» → no-op →
// повернення залишку → статус), не фабричний update.
export const listOrders = createServerFn({ method: 'GET' })
  .validator(ordersOps.subsetSchema)
  .handler(ordersOps.list);

export const listOrderItems = createServerFn({ method: 'GET' })
  .validator(orderItemsOps.subsetSchema)
  .handler(orderItemsOps.list);

export const changeOrderStatus = createServerFn({ method: 'POST' })
  .validator(changeOrderStatusInput)
  .handler(changeOrderStatusOp);

// Е5б-8: редагування позицій оформленого замовлення — іменовані операції
// (ціна рушієм чекауту, дельта залишку, перерахунок сум і доставки).
export const addOrderItem = createServerFn({ method: 'POST' })
  .validator(addOrderItemInput)
  .handler(addOrderItemOp);

export const updateOrderItemQuantity = createServerFn({ method: 'POST' })
  .validator(updateOrderItemQuantityInput)
  .handler(updateOrderItemQuantityOp);

export const removeOrderItem = createServerFn({ method: 'POST' })
  .validator(removeOrderItemInput)
  .handler(removeOrderItemOp);

// Е5б-4: вузький пошук товару для діалогу додавання позиції (не загальний
// пошук адмінки; `like` у subset.ts лишається забороненим).
export const searchProductsForOrder = createServerFn({ method: 'GET' })
  .validator(searchProductsForOrderInput)
  .handler(searchProductsForOrderOp);

// Тема 9: розмітка відгуку для модерації — очищена на сервері (див.
// impl/reviews/content.ts); сам рядок відгуку сторінка читає легасі-шляхом.
export const getAdminReviewContent = createServerFn({ method: 'GET' })
  .validator(reviewContentInput)
  .handler(getReviewContentOp);
