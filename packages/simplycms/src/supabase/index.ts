// Кореневий барель пакета — лише типи БД і резолв ключів.
//
// Клієнти (browser/server/anon) та SupabaseProvider свідомо НЕ реекспортуються
// звідси: server-client тягне `@tanstack/react-start/server`, тож його попадання
// в кореневий барель затягувало б серверний код у клієнтський бандл.
// Імпортуй їх підшляхами: `simplycms/supabase/browser-client` тощо.

export type {
  Json,
  Database,
  Tables,
  TablesInsert,
  TablesUpdate,
  Enums,
  CompositeTypes,
} from './database';

export { Constants } from './database';

export { resolveSupabaseKeys } from './keys';
export type { SupabaseEnv, SupabaseKeys } from './keys';
