import { authUsers } from 'drizzle-orm/supabase';

// `auth.users` лежить поза `schemaFilter: ['public']`, тому `drizzle-kit pull` її
// не емітить і лишає «висячі» посилання у зовнішніх ключах `schema.ts`.
//
// 🔴 Таблиця живе в ОКРЕМОМУ файлі і НЕ реекспортується зі `schema.ts` навмисно:
// drizzle-kit збирає сутності з експортів файлів, перелічених у `config.schema`.
// Якщо експортувати її звідти, kit вважатиме `auth.users` «своєю» і згенерує
// `CREATE TABLE "auth"."users"` (drizzle-kit 0.31 ігнорує `schemaFilter` на боці
// TS-схеми). Як імпорт вона лишається валідною ціллю для `foreignKey(...)`.
export const usersInAuth = authUsers;
