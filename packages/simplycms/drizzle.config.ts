import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'drizzle-kit';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// drizzle-kit транспілює конфіг у CJS, тому `import.meta.dirname` тут undefined —
// теку беремо з `import.meta.url`, який лишається валідним.
const here = dirname(fileURLToPath(import.meta.url));

// drizzle-kit не читає `.env.local` автоматично (лише `.env`) — вантажимо явно.
loadEnv({ path: resolve(here, '../../.env.local') });

// 🔴 `schema`/`out` МУСЯТЬ бути відносними: drizzle-kit 0.31 у `generate` склеює
// `./${out}` і на абсолютному шляху падає з ENOENT. Отже команди запускаються з
// cwd = тека цього пакета (root-скрипти роблять це через `pnpm --filter`).
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/schema.ts',
  // МЕТА+snapshots+staging SQL Drizzle — ОКРЕМО від канону `migrations/`:
  // журнал і snapshot потрібні самому drizzle-kit, а канон тримає лише
  // застосовний SQL із ручним порядком (0000_prelude → 0003_seed).
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL! },
  // Схема одна — `public`; ані GoTrue, ані storage у v2 більше немає (B13).
  schemaFilter: ['public'],
  // 🔴 Ролі drizzle-kit НЕ веде: `app_runtime`/`app_user`/`app_admin`
  // створює `migrations/0000_prelude.sql` ДО таблиць, бо на них посилаються
  // і політики (`to app_user`), і гранти. Провайдер `supabase` тут помер
  // разом зі стеком GoTrue — лишити його означало б, що drizzle мовчки
  // вважає ролі платформи наявними, а наші — своїми до створення.
  entities: { roles: false },
});
