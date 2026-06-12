// Типи бази даних надаються сайтом-споживачем.
// Аліас @simplysoftua/db-types мапиться в tsconfig.json сайту
// на автоматично згенерований файл типів Supabase (supabase/types.ts).
//
// Для генерації типів: pnpm db:generate-types

export type {
  Json,
  Database,
  Tables,
  TablesInsert,
  TablesUpdate,
  Enums,
  CompositeTypes,
} from "@simplysoftua/db-types";

export { Constants } from "@simplysoftua/db-types";
