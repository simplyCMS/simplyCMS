// Кореневий барель пакета i18n.
//
// Контракт: транслятор створюється per-request/per-render від мови інтерфейсу.
// Глобального mutable-стану (`setLocale`) немає навмисно — SSR-safety.

export { createTranslator, languageOfConfigLocale } from './translator';
export { interpolate, lookupMessage } from './lookup';
export { LANGUAGE_PACKS, getLanguagePack } from './packs';
export {
  resolveUiLocale,
  resolveUiLocalePair,
  toUiLocale,
  hasUiPack,
} from './ui-locale';
export type { UiLocale, UiLocalePair } from './ui-locale';
export {
  I18nProvider,
  useT,
  useUiLocale,
  useUiLocalePair,
} from './I18nProvider';
export type {
  MessageKey,
  MessageParams,
  Catalog,
  LanguagePack,
  Translator,
} from './types';
