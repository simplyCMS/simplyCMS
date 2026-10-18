// simplycms/translations — серверна механіка перекладів (T2, server-only).
export { sourceFieldHash } from './hash';
export {
  TRANSLATABLE,
  fieldFromWire,
  fieldToWire,
  type TranslatableEntity,
  type TranslatableKey,
} from './specs';
export {
  loadTranslations,
  primaryLocaleCode,
  withFallback,
  type StoredTranslation,
} from './read';
export { applyTranslationPlan, deleteTranslation } from './upsert';
export {
  GALLERY_ORDER,
  lineImageSql,
  mainImageSql,
  modificationGallerySql,
  productFirstImageSql,
  productGallerySql,
} from './gallery';
