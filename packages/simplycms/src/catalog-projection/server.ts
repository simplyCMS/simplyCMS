// simplycms/catalog-projection — серверна проєкція каталогу для вітрини (T2, server-only).
export {
  buildMissingProjection,
  dropLocaleProjection,
  missingProjectionRows,
  refreshProductTexts,
} from './product-texts';
export {
  findProjectionMismatches,
  localeProjectionMismatches,
  reconcileProductTexts,
  type MismatchKey,
} from './reconcile';
