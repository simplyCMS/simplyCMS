// Кореневий барель пакета i18n.
//
// Контракт: транслятор створюється per-request/per-render від мови інтерфейсу.
// Глобального mutable-стану (`setLocale`) немає навмисно — SSR-safety.

export { createTranslator } from './translator';
export { useFormatDate } from './format';
export { loadUiCatalog, loadTranslator, useUiCatalogs } from './registry';
export { interpolate, lookupMessage } from './lookup';
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
  UiCatalogPart,
  PartCatalog,
  MessageParams,
  LanguagePack,
  Translator,
} from './types';
