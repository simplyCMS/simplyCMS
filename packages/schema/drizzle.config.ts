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
  schema: './src/schema.ts',
  // МЕТА+snapshots+staging SQL Drizzle — ОКРЕМО від supabase/migrations
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL! },
  // НЕ тягнути auth/storage/realtime
  schemaFilter: ['public'],
  entities: { roles: { provider: 'supabase' } },
});
