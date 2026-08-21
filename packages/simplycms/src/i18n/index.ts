// Кореневий барель пакета i18n.
//
// Контракт: транслятор створюється per-request/per-render від локалі з конфіга.
// Глобального mutable-стану (`setLocale`) немає навмисно — SSR-safety.

export { createTranslator, normalizeLocale, interpolate } from './translator';
export { I18nProvider, useT, useLocale } from './I18nProvider';
export type {
  Locale,
  MessageKey,
  MessageParams,
  Catalog,
  Translator,
} from './types';
