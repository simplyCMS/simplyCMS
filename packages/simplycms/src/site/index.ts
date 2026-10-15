/**
 * 🔴 Server-only (contracts/server-only): кеші читання профілю магазину й
 * активної теми (узгоджені між репліками поколіннями в БД, Д6) та реєстр вшитих
 * тем. Вітрина читає, адмінка збільшує покоління в транзакції мутації — тому
 * окремий модуль, а не лоадери вітрини: `admin-server` не сміє імпортувати
 * лоадери вітрини (тір-зони).
 * Читання профілю приймає `ActorDb`; покоління читає `readGenerations` через
 * `withActor` (роль `app_user`), контекст запиту — `simplycms/site/request-context`.
 */
export {
  createReadCache,
  storeProfileCache,
  activeThemeCache,
} from './read-cache';
export type { ReadCache, ThemeRecord } from './read-cache';
export {
  CACHE_KEYS,
  bumpCacheGeneration,
  readGenerations,
} from './cache-generations';
export type { CacheKey } from './cache-generations';
export { readStoreProfile, toStorefrontProfile } from './store-profile';
export { declareBuiltThemes, isBuiltTheme } from './built-themes';
export { declareStoreLocale, getStoreLocale } from './store-locale';
export { declareStoreCurrency, getStoreCurrency } from './store-currency';
