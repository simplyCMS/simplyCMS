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
export { orderStatusesOps } from './resources/order-statuses';
export {
  setDefaultInput,
  setDefaultOrderStatusOp,
} from './operations/order-status-default';
export {
  reorderInput,
  reorderOrderStatusOp,
} from './operations/order-status-reorder';
export {
  removeStatusInput,
  removeManyInput,
  removeManyOrderStatusesOp,
} from './operations/order-status-remove';
