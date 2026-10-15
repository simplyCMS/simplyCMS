// Кореневий барель пакета i18n.
//
// Контракт: транслятор створюється per-request/per-render від локалі з конфіга.
// Глобального mutable-стану (`setLocale`) немає навмисно — SSR-safety.

export { createTranslator, languageOf, interpolate } from './translator';
export { LANGUAGE_PACKS, getLanguagePack } from './packs';
export { I18nProvider, useT, useLocale } from './I18nProvider';
export type {
  Locale,
  MessageKey,
  MessageParams,
  Catalog,
  LanguagePack,
  Translator,
} from './types';
