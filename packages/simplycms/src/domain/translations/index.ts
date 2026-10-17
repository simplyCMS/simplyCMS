// simplycms/domain/translations — чиста логіка перекладів (T1): статуси полів і
// рядків, «перекладено для SEO», план запису. Клієнтобезпечний за побудовою
// (доводить `tests/domain-translations-client-safe.test.ts`); sha256 живе
// лише в серверному `simplycms/translations`.

export {
  fallbackFieldsOf,
  fieldHasText,
  fieldStatus,
  isRichField,
  isTranslatedForSeo,
  rowStatus,
  toSourceRow,
  type FieldStatus,
  type SourceRow,
  type TranslatableSpec,
  type TranslationRow,
} from './status';
export { hasRichText, hasText, normalizeTextInput } from './text';
export { richTextToPlain } from './plain-text';
export {
  planTranslationWrite,
  type TranslationUpsert,
  type TranslationWriteInput,
  type TranslationWritePlan,
} from './write-plan';
