// Кореневий барель пакета i18n.
//
// Контракт: транслятор створюється per-request/per-render від локалі з конфіга.
// Глобального mutable-стану (`setLocale`) немає навмисно — SSR-safety.

export { createTranslator, normalizeLocale } from './translator';
export { I18nProvider, useT } from './I18nProvider';
export type {
  Locale,
  MessageKey,
  MessageParams,
  Catalog,
  Translator,
} from './types';
