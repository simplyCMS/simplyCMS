/**
 * 🔴 Server-only (contracts/server-only): процесний кеш профілю магазину й
 * активної теми та реєстр вшитих тем. Один модульний стан для вітрини (читає)
 * і адмінки (скидає після COMMIT) — тому окремий модуль, а не лоадери вітрини:
 * `admin-server` не сміє імпортувати лоадери вітрини (тір-зони).
 * Власного каналу до БД немає: кожна функція приймає `ActorDb`.
 */
export {
  createReadCache,
  storeProfileCache,
  activeThemeCache,
} from './read-cache';
export type { ReadCache, ThemeRecord } from './read-cache';
export { readStoreProfile, toStorefrontProfile } from './store-profile';
export { declareBuiltThemes, isBuiltTheme } from './built-themes';
