import { createServerFn } from '@tanstack/react-start';
// 🔴 BARE-специфікатор, не './impl': відносний імпорт бандлер заінлайнив би,
// і розрізнення «стаб vs нетрансформований» у dist зникло б (див. impl/).
// Стереже правило server-only-relative.
import {
  adminInput,
  uploadFormInput,
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
  shippingMethodsOps,
  removeShippingMethodsInput,
  removeShippingMethodsOp,
  shippingZonesOps,
  setDefaultShippingZoneInput,
  setDefaultShippingZoneOp,
  removeShippingZonesInput,
  removeShippingZonesOp,
  shippingRatesOps,
  pickupPointsOps,
  removePickupPointsInput,
  removePickupPointsOp,
  getSystemSettingsOp,
  storeProfileInput,
  saveStoreProfileOp,
  saveStockManagementInput,
  saveStockManagementOp,
  listThemesOp,
  activateThemeInput,
  activateThemeOp,
  saveThemeSettingsInput,
  saveThemeSettingsOp,
  listPluginsOp,
  setPluginActiveInput,
  setPluginActiveOp,
  discountGroupsOps,
  removeDiscountGroupsInput,
  removeDiscountGroupsOp,
  discountsOps,
  getDiscountInput,
  getDiscountOp,
  saveDiscountInput,
  saveDiscountOp,
} from 'simplycms/admin-server/impl';

// Типи рядків для UI (Е6б-15/17): `export type` стирається компілятором, тож
// живим не-serverFn експортом не є і клієнтську трансформацію не ламає.
export type {
  PluginRow,
  SystemSettings,
  ThemeRow,
} from 'simplycms/admin-server/impl';

/**
 * 🔴 Публічна поверхня admin-server: ЛИШЕ serverFn (К3-9′ п.1). Жодного
 * живого не-serverFn експорту: клієнтська трансформація Start вирізає
 * validator і handler та чистить осиротілі імпорти DCE-проходом —
 * але лише доки їх не тримає інший живий експорт. Схеми/операції назовні
 * НЕ реекспортуються.
 */
export const listOrderStatuses = createServerFn({ method: 'GET' })
  .validator(adminInput(orderStatusesOps.subsetSchema))
  .handler(orderStatusesOps.list);

export const insertOrderStatuses = createServerFn({ method: 'POST' })
  .validator(adminInput(orderStatusesOps.insertSchema))
  .handler(orderStatusesOps.insert);

export const updateOrderStatuses = createServerFn({ method: 'POST' })
  .validator(adminInput(orderStatusesOps.updateSchema))
  .handler(orderStatusesOps.update);

// 🔴 remove ЦІЄЇ сутності — guarded-операція, не фабричний ops.remove:
// «не видалити дефолтний» — доменний інваріант (критерій К3-4′).
export const removeOrderStatuses = createServerFn({ method: 'POST' })
  .validator(adminInput(removeManyInput))
  .handler(removeManyOrderStatusesOp);

export const setDefaultOrderStatus = createServerFn({ method: 'POST' })
  .validator(adminInput(setDefaultInput))
  .handler(setDefaultOrderStatusOp);

export const reorderOrderStatus = createServerFn({ method: 'POST' })
  .validator(adminInput(reorderInput))
  .handler(reorderOrderStatusOp);

// 🔴 Валідатор — функція, а не Zod-схема: `validator` зі схемою не
// приймає FormData (Start типізує цю гілку окремо). Вміст форми перевіряє
// `parseUploadForm` усередині операції.
export const uploadMedia = createServerFn({ method: 'POST' })
  .validator(uploadFormInput)
  .handler(uploadMediaOp);

export const deleteMedia = createServerFn({ method: 'POST' })
  .validator(adminInput(deleteMediaInput))
  .handler(deleteMediaOp);

// 🔴 Task 3 (Е3): файл переростає канон 150 рядків СВІДОМО — К3-9′ вимагає
// ЄДИНОГО модуля serverFn, і розбиття його на кілька змінило б межу, яку
// стереже Gate C (стаб-маркер dist/admin-server/index). Кожен serverFn —
// топ-рівневий const (гейт server-fn-top-level).

export const listProducts = createServerFn({ method: 'GET' })
  .validator(adminInput(productsOps.subsetSchema))
  .handler(productsOps.list);

export const insertProducts = createServerFn({ method: 'POST' })
  .validator(adminInput(productsOps.insertSchema))
  .handler(productsOps.insert);

export const updateProducts = createServerFn({ method: 'POST' })
  .validator(adminInput(productsOps.updateSchema))
  .handler(productsOps.update);

export const removeProducts = createServerFn({ method: 'POST' })
  .validator(adminInput(productsOps.removeSchema))
  .handler(productsOps.remove);

export const listProductModifications = createServerFn({ method: 'GET' })
  .validator(adminInput(productModificationsOps.subsetSchema))
  .handler(productModificationsOps.list);

export const insertProductModifications = createServerFn({ method: 'POST' })
  .validator(adminInput(productModificationsOps.insertSchema))
  .handler(productModificationsOps.insert);

export const updateProductModifications = createServerFn({ method: 'POST' })
  .validator(adminInput(productModificationsOps.updateSchema))
  .handler(productModificationsOps.update);

export const removeProductModifications = createServerFn({ method: 'POST' })
  .validator(adminInput(productModificationsOps.removeSchema))
  .handler(productModificationsOps.remove);

// 🔴 Task 4 (Е3): дефолт і порядок модифікацій — iменовані операції, не
// фабричний insert/update (single-default індекс, контракт хвиль Е1б).
export const setDefaultProductModification = createServerFn({
  method: 'POST',
})
  .validator(adminInput(setDefaultModificationInput))
  .handler(setDefaultModificationOp);

export const reorderProductModification = createServerFn({ method: 'POST' })
  .validator(adminInput(reorderModificationInput))
  .handler(reorderModificationOp);

export const listProductPrices = createServerFn({ method: 'GET' })
  .validator(adminInput(productPricesOps.subsetSchema))
  .handler(productPricesOps.list);

// 🔴 Атомарна заміна набору цін пари товар/модифікація (Е3-10) — не
// фабричні insert/update/remove: одна кнопка «Зберегти ціни», один акт.
export const saveProductPrices = createServerFn({ method: 'POST' })
  .validator(adminInput(saveProductPricesInput))
  .handler(saveProductPricesOp);

export const listStock = createServerFn({ method: 'GET' })
  .validator(adminInput(stockOps.subsetSchema))
  .handler(stockOps.list);

// 🔴 Ручний облік залишків з гвардованим переходом stock_status в ОДНІЙ
// транзакції (Е3-3) — не фабричний ops.update.
export const saveStock = createServerFn({ method: 'POST' })
  .validator(adminInput(saveStockInput))
  .handler(saveStockOp);

export const listProductPropertyValues = createServerFn({ method: 'GET' })
  .validator(adminInput(productPropertyValuesOps.subsetSchema))
  .handler(productPropertyValuesOps.list);

export const insertProductPropertyValues = createServerFn({ method: 'POST' })
  .validator(adminInput(productPropertyValuesOps.insertSchema))
  .handler(productPropertyValuesOps.insert);

export const updateProductPropertyValues = createServerFn({ method: 'POST' })
  .validator(adminInput(productPropertyValuesOps.updateSchema))
  .handler(productPropertyValuesOps.update);

export const removeProductPropertyValues = createServerFn({ method: 'POST' })
  .validator(adminInput(productPropertyValuesOps.removeSchema))
  .handler(productPropertyValuesOps.remove);

export const listModificationPropertyValues = createServerFn({ method: 'GET' })
  .validator(adminInput(modificationPropertyValuesOps.subsetSchema))
  .handler(modificationPropertyValuesOps.list);

export const insertModificationPropertyValues = createServerFn({
  method: 'POST',
})
  .validator(adminInput(modificationPropertyValuesOps.insertSchema))
  .handler(modificationPropertyValuesOps.insert);

export const updateModificationPropertyValues = createServerFn({
  method: 'POST',
})
  .validator(adminInput(modificationPropertyValuesOps.updateSchema))
  .handler(modificationPropertyValuesOps.update);

export const removeModificationPropertyValues = createServerFn({
  method: 'POST',
})
  .validator(adminInput(modificationPropertyValuesOps.removeSchema))
  .handler(modificationPropertyValuesOps.remove);

// 🔴 Task 3 (Е4): довідники каталогу — записувані ресурси замість читальних
// Е3 (Е3-1 → Е4). Операція всього CRUD — catalog.write (Е3-6). Незмінні
// після створення колонки — insertOnly фабрики (Е4-5); slug/code перевіряє
// сервер (Е4-7). remove і setDefault типу ціни — іменовані (Task 4, Е4-2),
// фабричного remove для типів цін немає.

export const listSections = createServerFn({ method: 'GET' })
  .validator(adminInput(sectionsOps.subsetSchema))
  .handler(sectionsOps.list);

export const insertSections = createServerFn({ method: 'POST' })
  .validator(adminInput(sectionsOps.insertSchema))
  .handler(sectionsOps.insert);

export const updateSections = createServerFn({ method: 'POST' })
  .validator(adminInput(sectionsOps.updateSchema))
  .handler(sectionsOps.update);

export const removeSections = createServerFn({ method: 'POST' })
  .validator(adminInput(sectionsOps.removeSchema))
  .handler(sectionsOps.remove);

export const listPriceTypes = createServerFn({ method: 'GET' })
  .validator(adminInput(priceTypesOps.subsetSchema))
  .handler(priceTypesOps.list);

export const insertPriceTypes = createServerFn({ method: 'POST' })
  .validator(adminInput(priceTypesOps.insertSchema))
  .handler(priceTypesOps.insert);

export const updatePriceTypes = createServerFn({ method: 'POST' })
  .validator(adminInput(priceTypesOps.updateSchema))
  .handler(priceTypesOps.update);

// 🔴 Task 4 (Е4-2): remove ЦІЄЇ сутності — guarded, не фабричний: «не
// видалити дефолтний» — доменний інваріант. Обидві операції серіалізує
// той самий advisory-lock `price-type-default`.
export const removePriceTypes = createServerFn({ method: 'POST' })
  .validator(adminInput(removePriceTypesInput))
  .handler(removeManyPriceTypesOp);

export const setDefaultPriceType = createServerFn({ method: 'POST' })
  .validator(adminInput(setDefaultPriceTypeInput))
  .handler(setDefaultPriceTypeOp);

export const listSectionProperties = createServerFn({ method: 'GET' })
  .validator(adminInput(sectionPropertiesOps.subsetSchema))
  .handler(sectionPropertiesOps.list);

export const insertSectionProperties = createServerFn({ method: 'POST' })
  .validator(adminInput(sectionPropertiesOps.insertSchema))
  .handler(sectionPropertiesOps.insert);

export const updateSectionProperties = createServerFn({ method: 'POST' })
  .validator(adminInput(sectionPropertiesOps.updateSchema))
  .handler(sectionPropertiesOps.update);

export const removeSectionProperties = createServerFn({ method: 'POST' })
  .validator(adminInput(sectionPropertiesOps.removeSchema))
  .handler(sectionPropertiesOps.remove);

export const listPropertyOptions = createServerFn({ method: 'GET' })
  .validator(adminInput(propertyOptionsOps.subsetSchema))
  .handler(propertyOptionsOps.list);

export const insertPropertyOptions = createServerFn({ method: 'POST' })
  .validator(adminInput(propertyOptionsOps.insertSchema))
  .handler(propertyOptionsOps.insert);

export const updatePropertyOptions = createServerFn({ method: 'POST' })
  .validator(adminInput(propertyOptionsOps.updateSchema))
  .handler(propertyOptionsOps.update);

export const removePropertyOptions = createServerFn({ method: 'POST' })
  .validator(adminInput(propertyOptionsOps.removeSchema))
  .handler(propertyOptionsOps.remove);

export const listSectionPropertyAssignments = createServerFn({
  method: 'GET',
})
  .validator(adminInput(sectionPropertyAssignmentsOps.subsetSchema))
  .handler(sectionPropertyAssignmentsOps.list);

export const insertSectionPropertyAssignments = createServerFn({
  method: 'POST',
})
  .validator(adminInput(sectionPropertyAssignmentsOps.insertSchema))
  .handler(sectionPropertyAssignmentsOps.insert);

export const updateSectionPropertyAssignments = createServerFn({
  method: 'POST',
})
  .validator(adminInput(sectionPropertyAssignmentsOps.updateSchema))
  .handler(sectionPropertyAssignmentsOps.update);

export const removeSectionPropertyAssignments = createServerFn({
  method: 'POST',
})
  .validator(adminInput(sectionPropertyAssignmentsOps.removeSchema))
  .handler(sectionPropertyAssignmentsOps.remove);

// 🔴 Task 4 (Е5): замовлення — лише читання через фабрику; зміна статусу —
// іменована операція (лок рядка → «скасоване — кінцеве» → no-op →
// повернення залишку → статус), не фабричний update.
export const listOrders = createServerFn({ method: 'GET' })
  .validator(adminInput(ordersOps.subsetSchema))
  .handler(ordersOps.list);

export const listOrderItems = createServerFn({ method: 'GET' })
  .validator(adminInput(orderItemsOps.subsetSchema))
  .handler(orderItemsOps.list);

export const changeOrderStatus = createServerFn({ method: 'POST' })
  .validator(adminInput(changeOrderStatusInput))
  .handler(changeOrderStatusOp);

// Е5б-8: редагування позицій оформленого замовлення — іменовані операції
// (ціна рушієм чекауту, дельта залишку, перерахунок сум і доставки).
export const addOrderItem = createServerFn({ method: 'POST' })
  .validator(adminInput(addOrderItemInput))
  .handler(addOrderItemOp);

export const updateOrderItemQuantity = createServerFn({ method: 'POST' })
  .validator(adminInput(updateOrderItemQuantityInput))
  .handler(updateOrderItemQuantityOp);

export const removeOrderItem = createServerFn({ method: 'POST' })
  .validator(adminInput(removeOrderItemInput))
  .handler(removeOrderItemOp);

// Е5б-4: вузький пошук товару для діалогу додавання позиції (не загальний
// пошук адмінки; `like` у subset.ts лишається забороненим).
export const searchProductsForOrder = createServerFn({ method: 'GET' })
  .validator(adminInput(searchProductsForOrderInput))
  .handler(searchProductsForOrderOp);

// Тема 9: розмітка відгуку для модерації — очищена на сервері (див.
// impl/reviews/content.ts); сам рядок відгуку сторінка читає легасі-шляхом.
export const getAdminReviewContent = createServerFn({ method: 'GET' })
  .validator(adminInput(reviewContentInput))
  .handler(getReviewContentOp);

// Е6а, Task 4: доставка (`shipping.manage`, Е6а-11). Insert/update способів,
// зон і точок — фабрика з guard-хуком під `shipping-config` (Е6а-16); remove
// для них — лише іменовані guarded-операції (Е6а-12, Е6а-17). Тарифи
// видаляє generic remove фабрики без локу (Е6а-22).
export const listShippingMethods = createServerFn({ method: 'GET' })
  .validator(adminInput(shippingMethodsOps.subsetSchema))
  .handler(shippingMethodsOps.list);

export const insertShippingMethods = createServerFn({ method: 'POST' })
  .validator(adminInput(shippingMethodsOps.insertSchema))
  .handler(shippingMethodsOps.insert);

export const updateShippingMethods = createServerFn({ method: 'POST' })
  .validator(adminInput(shippingMethodsOps.updateSchema))
  .handler(shippingMethodsOps.update);

export const removeShippingMethods = createServerFn({ method: 'POST' })
  .validator(adminInput(removeShippingMethodsInput))
  .handler(removeShippingMethodsOp);

export const listShippingZones = createServerFn({ method: 'GET' })
  .validator(adminInput(shippingZonesOps.subsetSchema))
  .handler(shippingZonesOps.list);

export const insertShippingZones = createServerFn({ method: 'POST' })
  .validator(adminInput(shippingZonesOps.insertSchema))
  .handler(shippingZonesOps.insert);

export const updateShippingZones = createServerFn({ method: 'POST' })
  .validator(adminInput(shippingZonesOps.updateSchema))
  .handler(shippingZonesOps.update);

export const removeShippingZones = createServerFn({ method: 'POST' })
  .validator(adminInput(removeShippingZonesInput))
  .handler(removeShippingZonesOp);

export const setDefaultShippingZone = createServerFn({ method: 'POST' })
  .validator(adminInput(setDefaultShippingZoneInput))
  .handler(setDefaultShippingZoneOp);

export const listShippingRates = createServerFn({ method: 'GET' })
  .validator(adminInput(shippingRatesOps.subsetSchema))
  .handler(shippingRatesOps.list);

export const insertShippingRates = createServerFn({ method: 'POST' })
  .validator(adminInput(shippingRatesOps.insertSchema))
  .handler(shippingRatesOps.insert);

export const updateShippingRates = createServerFn({ method: 'POST' })
  .validator(adminInput(shippingRatesOps.updateSchema))
  .handler(shippingRatesOps.update);

export const removeShippingRates = createServerFn({ method: 'POST' })
  .validator(adminInput(shippingRatesOps.removeSchema))
  .handler(shippingRatesOps.remove);

export const listPickupPoints = createServerFn({ method: 'GET' })
  .validator(adminInput(pickupPointsOps.subsetSchema))
  .handler(pickupPointsOps.list);

export const insertPickupPoints = createServerFn({ method: 'POST' })
  .validator(adminInput(pickupPointsOps.insertSchema))
  .handler(pickupPointsOps.insert);

export const updatePickupPoints = createServerFn({ method: 'POST' })
  .validator(adminInput(pickupPointsOps.updateSchema))
  .handler(pickupPointsOps.update);

export const removePickupPoints = createServerFn({ method: 'POST' })
  .validator(adminInput(removePickupPointsInput))
  .handler(removePickupPointsOp);

// К3-Е6б, Task 3: системні налаштування (`settings.manage`, Е6б-13). Профіль
// і облік — окремі операції (Е6б-21); активація теми — під локом `site-theme`
// (Е6б-15); кеш вітрини скидають самі операції після COMMIT (Е6б-9).
// Читання без вводу — без валідатора: перевіряти нічого.
export const getSystemSettings = createServerFn({ method: 'GET' }).handler(
  getSystemSettingsOp,
);

export const saveStoreProfile = createServerFn({ method: 'POST' })
  .validator(adminInput(storeProfileInput))
  .handler(saveStoreProfileOp);

export const saveStockManagement = createServerFn({ method: 'POST' })
  .validator(adminInput(saveStockManagementInput))
  .handler(saveStockManagementOp);

export const listThemes = createServerFn({ method: 'GET' }).handler(
  listThemesOp,
);

export const activateTheme = createServerFn({ method: 'POST' })
  .validator(adminInput(activateThemeInput))
  .handler(activateThemeOp);

export const saveThemeSettings = createServerFn({ method: 'POST' })
  .validator(adminInput(saveThemeSettingsInput))
  .handler(saveThemeSettingsOp);

export const listPlugins = createServerFn({ method: 'GET' }).handler(
  listPluginsOp,
);

export const setPluginActive = createServerFn({ method: 'POST' })
  .validator(adminInput(setPluginActiveInput))
  .handler(setPluginActiveOp);

// К3-Е6в, Task 5: знижки (`discount.manage`, Е6в-14). Insert/update груп —
// фабрика з guard-ом циклу й пари дат під `discount-config` (Е6в-17);
// видалення груп — лише іменована операція з піддеревом. Знижка пишеться
// ЛИШЕ атомарним `saveDiscount` (Е6в-16); фабрика знижок дає список і
// generic remove (цілі й умови — каскадом).
export const listDiscountGroups = createServerFn({ method: 'GET' })
  .validator(adminInput(discountGroupsOps.subsetSchema))
  .handler(discountGroupsOps.list);

export const insertDiscountGroups = createServerFn({ method: 'POST' })
  .validator(adminInput(discountGroupsOps.insertSchema))
  .handler(discountGroupsOps.insert);

export const updateDiscountGroups = createServerFn({ method: 'POST' })
  .validator(adminInput(discountGroupsOps.updateSchema))
  .handler(discountGroupsOps.update);

export const removeDiscountGroups = createServerFn({ method: 'POST' })
  .validator(adminInput(removeDiscountGroupsInput))
  .handler(removeDiscountGroupsOp);

export const listDiscounts = createServerFn({ method: 'GET' })
  .validator(adminInput(discountsOps.subsetSchema))
  .handler(discountsOps.list);

export const getDiscount = createServerFn({ method: 'GET' })
  .validator(adminInput(getDiscountInput))
  .handler(getDiscountOp);

export const saveDiscount = createServerFn({ method: 'POST' })
  .validator(adminInput(saveDiscountInput))
  .handler(saveDiscountOp);

export const removeDiscounts = createServerFn({ method: 'POST' })
  .validator(adminInput(discountsOps.removeSchema))
  .handler(discountsOps.remove);
