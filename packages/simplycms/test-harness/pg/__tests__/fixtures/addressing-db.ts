// Спільна БД реєстрів адрес і токенів (М1, Task 5): канон на чистій базі,
// `DATABASE_URL` під app_runtime (генератори ядра ходять через `withActor`),
// фікстури товарів/модифікацій/мов власником і raw-транзакції від app_admin.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll } from 'vitest';
import { sql } from 'drizzle-orm';
import {
  advisoryXactLockShared,
  closeDbPool,
  withActor,
  type ActorDb,
} from 'simplycms/db';
import { LOCK_KEYS } from 'simplycms/db/lock-keys';
import { resolveHarness } from '../../up.mjs';
import * as H from '../../apply.mjs';
import { withActor as rawActor } from '../../actors.mjs';
import {
  inLockedBlock,
  insertProductGraphAt,
  modificationGraphSql,
  modificationSql,
  productGraphStatements,
  slugTokenRowSql,
  urlPathRowSql,
} from './product-graph';

export const ADMIN = {
  userId: '33333333-3333-4333-8333-333333333333',
  role: 'app_admin',
} as const;

export interface AddressingDb {
  /** DSN бази власником схеми: для зовнішніх «тримачів» локів (`holdRowLock`). */
  url: () => string;
  /** SQL власником БД: фікстури й перевірки стану. */
  q: (sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;
  /**
   * SQL власником під ексклюзивним замком `languages-set` (хелпер харнеса): так пишуться
   * рядки реєстрів адрес і токенів, на які стоїть тригер замка (SC004).
   */
  w: (sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;
  /** Транзакція ядра від app_admin (коміт — у кінці `fn`). */
  admin: <T>(fn: (db: ActorDb) => Promise<T>) => Promise<T>;
  /** Те саме, але ПІД спільним замком `languages-set`, як творці адрес і пакетне заповнення. */
  shared: <T>(fn: (db: ActorDb) => Promise<T>) => Promise<T>;
  /** Сирі стейтменти однією транзакцією app_admin ПІД замком `languages-set`; відкладені тригери — на COMMIT. */
  tx: (...statements: string[]) => Promise<unknown>;
  /**
   * Товар графа з поточною адресою в кожній мові `draft`/`published`: `paths` — явні за
   * мовами, решта = `slug`. Товару без адреси не буває (тригер наявності, І16).
   */
  product: (slug?: string, paths?: Record<string, string>) => Promise<string>;
  /**
   * Новий товар БЕЗ адрес і `fn` над ним в ОДНІЙ транзакції app_admin під спільним
   * замком мов — як `products.create`: адреси пише `fn` (генератор, рядки реєстру), а
   * тригер наявності перевіряє їх на COMMIT.
   */
  fresh: <T>(fn: (db: ActorDb, id: string) => Promise<T>) => Promise<T>;
  /** Модифікація графа з поточним токеном у кожній мові: `tokens` — явні, решта = `slug`. */
  modification: (
    productId: string,
    slug?: string,
    tokens?: Record<string, string>,
  ) => Promise<string>;
  /** Нова модифікація БЕЗ токенів і `fn` над нею в одній транзакції (дзеркало `fresh`). */
  freshModification: <T>(
    productId: string,
    fn: (db: ActorDb, id: string) => Promise<T>,
  ) => Promise<T>;
  /** Додає мову (за замовчуванням `published`). */
  language: (code: string, status?: string) => Promise<void>;
}

/**
 * Новий товар графа БЕЗ адрес одним `do`-блоком під спільним замком мов: для транзакції
 * викликача, яка САМА пише адреси до свого COMMIT (тригер наявності, І16).
 */
export const freshProductSql = (id: string, slug = `p-${id}`): string =>
  inLockedBlock(
    productGraphStatements({ id, slug, name: slug, addresses: false }),
  );

/** Нова модифікація БЕЗ токенів (дзеркало `freshProductSql`). */
export const freshModificationSql = (
  productId: string,
  id: string,
  slug = `m-${id}`,
): string =>
  inLockedBlock(
    modificationSql(productId, { id, slug, name: slug, addresses: false }),
  );

export function useAddressingDb(prefix: string): AddressingDb {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = H.randomDbName(prefix);
  let dbUrl = '';
  let runtimeUrl = '';

  beforeAll(async () => {
    harness = await resolveHarness();
    await H.createTempDatabase(harness.url, dbName);
    dbUrl = H.withDbName(harness.url, dbName);
    await H.applyCanon(dbUrl);
    runtimeUrl = H.withUser(dbUrl, 'app_runtime');
    process.env.DATABASE_URL = runtimeUrl;
  }, 120_000);

  afterAll(async () => {
    // Пул закриваємо першим: інакше DROP DATABASE чекає живі зʼєднання.
    await closeDbPool();
    if (dbUrl) await H.dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  const q: AddressingDb['q'] = (sql, params = []) =>
    H.queryRows(dbUrl, sql, params) as Promise<Record<string, unknown>[]>;

  const w: AddressingDb['w'] = (sql, params = []) =>
    H.queryRowsLockingLanguages(dbUrl, sql, params) as unknown as Promise<
      Record<string, unknown>[]
    >;

  return {
    url: () => dbUrl,
    q,
    w,
    admin: (fn) => withActor({ role: 'app_admin', userId: ADMIN.userId }, fn),
    shared: (fn) =>
      withActor({ role: 'app_admin', userId: ADMIN.userId }, async (d) => {
        await advisoryXactLockShared(d, LOCK_KEYS.languagesSet);
        return fn(d);
      }),
    tx: (...statements) =>
      rawActor(runtimeUrl, ADMIN, [H.LANGUAGES_LOCK_SQL, ...statements]),
    product: async (slug = `p-${randomUUID()}`, paths) => {
      const id = randomUUID();
      await insertProductGraphAt(dbUrl, { id, slug, name: slug, paths });
      return id;
    },
    fresh: (fn) =>
      withActor({ role: 'app_admin', userId: ADMIN.userId }, async (d) => {
        const id = randomUUID();
        await d.execute(sql.raw(freshProductSql(id)));
        return fn(d, id);
      }),
    modification: async (productId, slug = `m-${randomUUID()}`, tokens) => {
      const id = randomUUID();
      await q(
        modificationGraphSql(productId, { id, slug, name: slug, tokens }),
      );
      return id;
    },
    freshModification: (productId, fn) =>
      withActor({ role: 'app_admin', userId: ADMIN.userId }, async (d) => {
        const id = randomUUID();
        await d.execute(sql.raw(freshModificationSql(productId, id)));
        return fn(d, id);
      }),
    language: async (code, status = 'published') => {
      await H.queryRowsLockingLanguages(
        dbUrl,
        `insert into public.languages (id, code, name, status, is_default, sort_order)
         values (gen_random_uuid(), $1::text, $1::text, $2::language_status, false, 5)`,
        [code, status],
      );
    },
  };
}

type Q = Pick<AddressingDb, 'q' | 'w'>;

/** Рядки реєстру адрес власником БД: вставка й вибірка історії товару. */
export const pathHelpers = ({ q, w }: Q) => ({
  addr: (
    locale: string,
    path: string,
    productId: string | null,
    current = true,
  ) => w(urlPathRowSql({ locale, path, productId, isCurrent: current })),
  rows: (productId: string) =>
    q(
      `select locale, path, is_current from public.url_paths
        where product_id = $1 order by locale, is_current desc, path`,
      [productId],
    ),
});

/** Те саме для реєстру токенів модифікацій. */
export const tokenHelpers = ({ q, w }: Q) => ({
  tok: (
    locale: string,
    slug: string,
    t: { id: string; scopeId: string | null },
    current = true,
  ) =>
    w(
      slugTokenRowSql({
        locale,
        scopeId: t.scopeId,
        slug,
        modificationId: t.id,
        isCurrent: current,
      }),
    ),
  rows: (id: string) =>
    q(
      `select locale, slug, is_current from public.slug_tokens
        where modification_id = $1 order by locale, is_current desc, slug`,
      [id],
    ),
});
