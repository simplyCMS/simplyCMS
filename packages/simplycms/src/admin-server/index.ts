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
