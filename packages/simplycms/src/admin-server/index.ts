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
  productPricesOps,
  stockOps,
  productPropertyValuesOps,
  modificationPropertyValuesOps,
  sectionsReadOps,
  priceTypesReadOps,
  sectionPropertyAssignmentsReadOps,
  sectionPropertiesReadOps,
  propertyOptionsReadOps,
} from 'simplycms/admin-server/impl';

/**
 * 🔴 Публічна поверхня admin-server: ЛИШЕ serverFn (К3-9′ п.1). Жодного
 * живого не-serverFn експорту: клієнтська трансформація Start вирізає
 * inputValidator і handler та чистить осиротілі імпорти DCE-проходом —
 * але лише доки їх не тримає інший живий експорт. Схеми/операції назовні
 * НЕ реекспортуються.
 */
export const listOrderStatuses = createServerFn({ method: 'GET' })
  .inputValidator(orderStatusesOps.subsetSchema)
  .handler(orderStatusesOps.list);

export const insertOrderStatuses = createServerFn({ method: 'POST' })
  .inputValidator(orderStatusesOps.insertSchema)
  .handler(orderStatusesOps.insert);

export const updateOrderStatuses = createServerFn({ method: 'POST' })
  .inputValidator(orderStatusesOps.updateSchema)
  .handler(orderStatusesOps.update);

// 🔴 remove ЦІЄЇ сутності — guarded-операція, не фабричний ops.remove:
// «не видалити дефолтний» — доменний інваріант (критерій К3-4′).
export const removeOrderStatuses = createServerFn({ method: 'POST' })
  .inputValidator(removeManyInput)
  .handler(removeManyOrderStatusesOp);

export const setDefaultOrderStatus = createServerFn({ method: 'POST' })
  .inputValidator(setDefaultInput)
  .handler(setDefaultOrderStatusOp);

export const reorderOrderStatus = createServerFn({ method: 'POST' })
  .inputValidator(reorderInput)
  .handler(reorderOrderStatusOp);

// 🔴 Валідатор — функція, а не Zod-схема: `inputValidator` зі схемою не
// приймає FormData (Start типізує цю гілку окремо). Вміст форми перевіряє
// `parseUploadForm` усередині операції.
export const uploadMedia = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown): FormData => {
    if (!(data instanceof FormData)) {
      throw new Error('[simplycms] uploadMedia expects FormData.');
    }
    return data;
  })
  .handler(uploadMediaOp);

export const deleteMedia = createServerFn({ method: 'POST' })
  .inputValidator(deleteMediaInput)
  .handler(deleteMediaOp);

// 🔴 Task 3 (Е3): файл переростає канон 150 рядків СВІДОМО — К3-9′ вимагає
// ЄДИНОГО модуля serverFn, і розбиття його на кілька змінило б межу, яку
// стереже Gate C (стаб-маркер dist/admin-server/index). Кожен serverFn —
// топ-рівневий const (гейт server-fn-top-level).

export const listProducts = createServerFn({ method: 'GET' })
  .inputValidator(productsOps.subsetSchema)
  .handler(productsOps.list);

export const insertProducts = createServerFn({ method: 'POST' })
  .inputValidator(productsOps.insertSchema)
  .handler(productsOps.insert);

export const updateProducts = createServerFn({ method: 'POST' })
  .inputValidator(productsOps.updateSchema)
  .handler(productsOps.update);

export const removeProducts = createServerFn({ method: 'POST' })
  .inputValidator(productsOps.removeSchema)
  .handler(productsOps.remove);

export const listProductModifications = createServerFn({ method: 'GET' })
  .inputValidator(productModificationsOps.subsetSchema)
  .handler(productModificationsOps.list);

export const insertProductModifications = createServerFn({ method: 'POST' })
  .inputValidator(productModificationsOps.insertSchema)
  .handler(productModificationsOps.insert);

export const updateProductModifications = createServerFn({ method: 'POST' })
  .inputValidator(productModificationsOps.updateSchema)
  .handler(productModificationsOps.update);

export const removeProductModifications = createServerFn({ method: 'POST' })
  .inputValidator(productModificationsOps.removeSchema)
  .handler(productModificationsOps.remove);

export const listProductPrices = createServerFn({ method: 'GET' })
  .inputValidator(productPricesOps.subsetSchema)
  .handler(productPricesOps.list);

export const listStock = createServerFn({ method: 'GET' })
  .inputValidator(stockOps.subsetSchema)
  .handler(stockOps.list);

export const listProductPropertyValues = createServerFn({ method: 'GET' })
  .inputValidator(productPropertyValuesOps.subsetSchema)
  .handler(productPropertyValuesOps.list);

export const insertProductPropertyValues = createServerFn({ method: 'POST' })
  .inputValidator(productPropertyValuesOps.insertSchema)
  .handler(productPropertyValuesOps.insert);

export const updateProductPropertyValues = createServerFn({ method: 'POST' })
  .inputValidator(productPropertyValuesOps.updateSchema)
  .handler(productPropertyValuesOps.update);

export const removeProductPropertyValues = createServerFn({ method: 'POST' })
  .inputValidator(productPropertyValuesOps.removeSchema)
  .handler(productPropertyValuesOps.remove);

export const listModificationPropertyValues = createServerFn({ method: 'GET' })
  .inputValidator(modificationPropertyValuesOps.subsetSchema)
  .handler(modificationPropertyValuesOps.list);

export const insertModificationPropertyValues = createServerFn({
  method: 'POST',
})
  .inputValidator(modificationPropertyValuesOps.insertSchema)
  .handler(modificationPropertyValuesOps.insert);

export const updateModificationPropertyValues = createServerFn({
  method: 'POST',
})
  .inputValidator(modificationPropertyValuesOps.updateSchema)
  .handler(modificationPropertyValuesOps.update);

export const removeModificationPropertyValues = createServerFn({
  method: 'POST',
})
  .inputValidator(modificationPropertyValuesOps.removeSchema)
  .handler(modificationPropertyValuesOps.remove);

export const listSections = createServerFn({ method: 'GET' })
  .inputValidator(sectionsReadOps.subsetSchema)
  .handler(sectionsReadOps.list);

export const listPriceTypes = createServerFn({ method: 'GET' })
  .inputValidator(priceTypesReadOps.subsetSchema)
  .handler(priceTypesReadOps.list);

export const listSectionPropertyAssignments = createServerFn({
  method: 'GET',
})
  .inputValidator(sectionPropertyAssignmentsReadOps.subsetSchema)
  .handler(sectionPropertyAssignmentsReadOps.list);

export const listSectionProperties = createServerFn({ method: 'GET' })
  .inputValidator(sectionPropertiesReadOps.subsetSchema)
  .handler(sectionPropertiesReadOps.list);

export const listPropertyOptions = createServerFn({ method: 'GET' })
  .inputValidator(propertyOptionsReadOps.subsetSchema)
  .handler(propertyOptionsReadOps.list);
