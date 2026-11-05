// Кореневий барель пакета i18n.
//
// Контракт: транслятор створюється per-request/per-render від мови інтерфейсу.
// Глобального mutable-стану (`setLocale`) немає навмисно — SSR-safety.

export { createTranslator, createLookupTranslator } from './translator';
export { useFormatDate } from './format';
export { plural } from './plural';
export { isCatalogValue } from './catalog-value';
export { loadUiCatalog, loadTranslator, useUiCatalogs } from './registry';
export { interpolate, lookupMessage } from './lookup';
export type { CatalogLink } from './lookup';
export {
  listLanguagePacks,
  hasLanguagePack,
  getUiPack,
  getContentTools,
} from './packs';
export type { LanguagePackInfo, UiPart } from './packs';
export {
  resolveUiLocale,
  resolveUiLocalePair,
  resolveAdminUiLocale,
  toUiLocale,
  PLATFORM_FALLBACK_UI,
} from './ui-locale';
export type { UiLocalePair } from './ui-locale';
export {
  I18nProvider,
  useT,
  useUiLocale,
  useUiLocalePair,
} from './I18nProvider';
export type {
  MessageKey,
  BaseKey,
  AdminKey,
  MailKey,
  PluralKey,
  StringKeyOf,
  PluralKeyOf,
  PluralForms,
  PluralTranslator,
  FoundForms,
  CatalogValue,
  UiCatalogPart,
  PartCatalog,
  MessageParams,
  LanguagePack,
  Translator,
} from './types';
