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
