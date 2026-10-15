// simplycms/domain/translations — чиста логіка перекладів (T1): статуси полів і
// рядків, «перекладено для SEO», план запису. Клієнтобезпечний за побудовою
// (доводить `tests/domain-translations-client-safe.test.ts`); sha256 живе
// лише в серверному `simplycms/translations`.

export {
  fieldStatus,
  hasText,
  isTranslatedForSeo,
  normalizeTextInput,
  rowStatus,
  type FieldStatus,
  type TranslatableSpec,
  type TranslationRow,
} from './status';
export { TranslationValidationError } from './write-parts';
export {
  planTranslationWrite,
  type TranslationUpsert,
  type TranslationWriteInput,
  type TranslationWritePlan,
} from './write-plan';
