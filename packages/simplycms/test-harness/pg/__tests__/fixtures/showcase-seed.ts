// Фікстури гейта С-8 (`showcase-seed*.test.ts`): засіяна демо-база сіду
// вітрини на унікальному імені й з власною медіатекою в tmp.
//
// 🔴 База готується тим самим шляхом, що й у команди (`prepareShowcaseDb` →
// `demo-db.mjs` з позначкою), але з `randomDbName`: справжню
// `simplycms_showcase` на стенді гейт не чіпає.
// 🔴 Пул `simplycms/db` кешується на процес — між базами `closeDbPool()`,
// інакше другий сід писав би в першу базу.
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { resetAuth } from 'simplycms/auth';
import { closeDbPool } from 'simplycms/db';
import {
  showcaseEnv,
  type ShowcaseEnv,
} from '../../../../../../scripts/showcase/env.mts';
import { seedShowcase } from '../../../../../../scripts/showcase/run.mts';
import {
  prepareShowcaseDb,
  SHOWCASE_DB_NAME,
  withShowcaseLock,
} from '../../../../../../scripts/showcase/showcase-db.mts';
import {
  dropTempDatabase,
  queryRows,
  randomDbName,
  withDbName,
} from '../../apply.mjs';

export type SeededShowcase = {
  /** Імʼя бази й суперюзерний рядок до неї — лише для читання асертами. */
  readonly name: string;
  readonly dbUrl: string;
  readonly env: ShowcaseEnv;
  /** Обсяг каталогу демо-бази ДО сіду — база для «≥N нових» (С-4). */
  readonly demo: { readonly sections: number; readonly products: number };
  readonly rows: <T>(sql: string, params?: unknown[]) => Promise<T[]>;
  readonly cleanup: () => Promise<void>;
};

const ENV_KEYS = [
  'DATABASE_URL',
  'BETTER_AUTH_SECRET',
  'BETTER_AUTH_URL',
  'VITE_SITE_URL',
  'MEDIA_ROOT',
] as const;

/** Чиста демо-база (канон + демо) з позначкою — шляхом команди. */
async function freshDemoDb(adminUrl: string, prefix: string): Promise<string> {
  const name = randomDbName(prefix);
  if (name === SHOWCASE_DB_NAME) throw new Error('гейт не чіпає базу команди');
  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();
  try {
    await withShowcaseLock(client, () =>
      prepareShowcaseDb({ client, url: adminUrl }, name),
    );
  } finally {
    await client.end();
  }
  return name;
}

/**
 * Демо-база + сід у власну медіатеку. Повертає хендл для асертів; пул
 * лишається відкритим на ЦЮ базу (для операцій ядра в тесті) — його
 * закриває `cleanup` або наступний `seedFreshShowcase`.
 */
export async function seedFreshShowcase(
  adminUrl: string,
  prefix: string,
): Promise<SeededShowcase> {
  await closeDbPool();
  const name = await freshDemoDb(adminUrl, prefix);
  const mediaRoot = await mkdtemp(join(tmpdir(), 'showcase-gate-media-'));
  const env = showcaseEnv(adminUrl, name, mediaRoot);
  const dbUrl = withDbName(adminUrl, name);
  const cleanup = async () => {
    await closeDbPool();
    resetAuth();
    for (const key of ENV_KEYS) delete process.env[key];
    await dropTempDatabase(adminUrl, name);
    await rm(mediaRoot, { recursive: true, force: true });
  };
  const [demo] = (await queryRows(
    dbUrl,
    `select (select count(*)::int from public.sections) as sections,
            (select count(*)::int from public.products) as products`,
  )) as { sections: number; products: number }[];
  try {
    await seedShowcase(env);
  } catch (error) {
    await cleanup();
    throw error;
  }
  return {
    name,
    dbUrl,
    env,
    demo: demo!,
    rows: async <T>(sql: string, params: unknown[] = []) =>
      (await queryRows(dbUrl, sql, params)) as T[],
    cleanup,
  };
}

/** Усі файли медіатеки (рекурсивно, без тимчасових `.tmp-*`). */
export async function mediaFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && !e.name.startsWith('.tmp-'))
    .map((e) => join(e.parentPath, e.name).slice(root.length + 1))
    .sort();
}

/** Кількість рядків у ключових таблицях — асерт «нічого не записано». */
export const KEY_TABLES = [
  'users',
  'profiles',
  'orders',
  'order_items',
  'products',
  'sections',
  'media',
  'product_reviews',
  'user_category_history',
  'discounts',
] as const;

export async function tableCounts(
  s: SeededShowcase,
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const t of KEY_TABLES) {
    const [r] = await s.rows<{ n: number }>(
      `select count(*)::int as n from public.${t}`,
    );
    out[t] = r!.n;
  }
  return out;
}
