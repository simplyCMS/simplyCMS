/**
 * `pnpm db:showcase` — локальна демо-база з правдоподібними даними.
 *
 * Кроки (усі під ОДНИМ адмін-зʼєднанням із сесійним локом команди):
 *   (1) `prepareShowcaseDb` — позначка бази й `db:demo` (С-16а);
 *   (2) очищення `.data/showcase-media` (С-13);
 *   (3) env: `DATABASE_URL` (`app_runtime`), секрет, `MEDIA_ROOT`;
 *   (4–5) `seedShowcase` — guard С-16б і наповнення;
 *   (6) `closeDbPool()` — інакше відкритий сокет пулу тримає процес;
 *   (7) звіт.
 *
 * Модуль імпортують і гейти (Task 7) — тому `main` стартує лише тоді, коли
 * файл запущено напряму, а `seedShowcase` реекспортується.
 */
import { realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeDbPool } from '../../packages/simplycms/src/db/index.ts';
import { showcaseEnv } from './env.mts';
import { resetShowcaseMediaDir } from './media-dir.mts';
import pg from 'pg';
import { printReport } from './report.mts';
import { seedShowcase } from './seed.mts';
import {
  prepareShowcaseDb,
  SHOWCASE_DB_NAME,
  withShowcaseLock,
} from './showcase-db.mts';

export { seedShowcase } from './seed.mts';

const REPO_ROOT = join(import.meta.dirname, '../..');

/** Службова база `postgres` того ж кластера — її `db:demo` не термінує. */
function adminUrlOf(raw: string): string {
  const url = new URL(raw);
  url.pathname = '/postgres';
  return url.toString();
}

async function main(): Promise<void> {
  const raw = process.env.PG_HARNESS_URL;
  if (!raw) {
    throw new Error(
      'Немає підключення: задай PG_HARNESS_URL (адмін-рядок кластера), напр. ' +
        'PG_HARNESS_URL=postgresql://pgtest@127.0.0.1:55434/postgres pnpm db:showcase',
    );
  }
  const url = adminUrlOf(raw);
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await withShowcaseLock(client, async () => {
      const db = await prepareShowcaseDb({ client, url }, SHOWCASE_DB_NAME);
      const mediaRoot = await resetShowcaseMediaDir(REPO_ROOT);
      const env = showcaseEnv(url, SHOWCASE_DB_NAME, mediaRoot);
      try {
        await seedShowcase(env);
      } finally {
        await closeDbPool();
      }
      printReport({ env, db });
    });
  } finally {
    await client.end();
  }
}

const entry = process.argv[1];
if (entry && realpathSync(entry) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(
      `❌ ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  });
}
