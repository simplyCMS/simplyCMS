// Тема 9 (санітизація HTML): два рубежі проти ЖИВОЇ БД.
//
// 🔴 Рубіж 1 (запис) — у БД лежить уже очищений рядок: перевіряється прямим
// SQL повз обидва шари застосунку. Рубіж 2 (віддача) — рядок, покладений у БД
// СИРИМ (старий запис, сід, демо-дані), віддається клієнту очищеним: перевіряється
// лоадерами вітрини й операціями читання адмінки. Без БД обидва твердження
// були б тестом моків: саме запис і читання з таблиці й складають поверхню
// збереженого XSS.
//
// serverFn тут НЕ викликаються (getRequest() без ALS-контексту падає) —
// requireGrant мокається модульно, операції беруться напряму.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { closeDbPool } from 'simplycms/db';
import { resolveHarness } from '../up.mjs';
import {
  applySqlFiles,
  createTempDatabase,
  dropTempDatabase,
  queryRows,
  randomDbName,
  withDbName,
  withUser,
} from '../apply.mjs';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));

vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: null, roles: ['admin'] },
    scope: 'any',
  })),
}));

import {
  getReviewContentOp,
  productsOps,
  propertyOptionsOps,
  sectionsOps,
} from 'simplycms/admin-server/impl';
import {
  insertProductReview,
  loadProduct,
  loadProductReviews,
  loadPropertyOption,
  loadSections,
  withCustomerDb,
  withStorefrontDb,
} from 'simplycms/storefront/loaders';

const MIGRATIONS = join(import.meta.dirname, '../../../migrations');
const canonFiles = (): string[] =>
  readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => join(MIGRATIONS, name));

/** Розмітка, у якій і корисний текст, і кілька класичних векторів. */
const EVIL =
  '<p>корисний текст</p><script>alert(1)</script>' +
  '<img src=x onerror=alert(1)><a href="javascript:alert(1)">клік</a>' +
  '<svg onload=alert(1)></svg><iframe src="https://evil.example"></iframe>';

/** Ознаки виконуваного вмісту — жодної не має лишитись у відповіді/БД. */
const FORBIDDEN = /<script|onerror|onload|javascript:|<svg|<iframe/i;

describe('санітизація HTML: запис і віддача проти живої БД (Тема 9)', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_html_sanitization');
  let dbUrl = '';
  const rnd = () => crypto.randomUUID();

  const productId = rnd();
  const productSlug = 'xss-product';
  const authorId = rnd();
  const propertyId = rnd();

  /** Автор відгуку мусить існувати в `users`: `product_reviews.user_id` — FK. */
  const seedUser = (id: string) =>
    queryRows(
      dbUrl,
      `insert into public.users (id, name, email) values ($1, 'Автор', $2)`,
      [id, `${id}@example.test`],
    );

  const scalar = async (sql: string, params: unknown[] = []) => {
    const [row] = (await queryRows(dbUrl, sql, params)) as Record<
      string,
      string | null
    >[];
    return Object.values(row ?? {})[0] ?? null;
  };

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applySqlFiles(dbUrl, canonFiles());
    await seedUser(authorId);
    await queryRows(
      dbUrl,
      `insert into public.products (id, slug, name, is_active) values ($1, $2, 'Товар', true)`,
      [productId, productSlug],
    );
    await queryRows(
      dbUrl,
      `insert into public.section_properties (id, slug, name, property_type, has_page)
       values ($1, 'xss-prop', 'Властивість', 'select', true)`,
      [propertyId],
    );
    process.env.DATABASE_URL = withUser(dbUrl, 'app_runtime');
  }, 120_000);

  afterAll(async () => {
    await closeDbPool();
    delete process.env.DATABASE_URL;
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  // ── Рубіж 1: запис ────────────────────────────────────────────────────────

  it('🔴 запис: відгук зі <script> зберігається очищеним', async () => {
    await withCustomerDb(authorId, (db) =>
      insertProductReview(db, authorId, {
        productId,
        rating: 5,
        title: 'Назва',
        content: EVIL,
        images: [],
      }),
    );
    const stored = await scalar(
      `select content from public.product_reviews where user_id = $1`,
      [authorId],
    );
    expect(stored).not.toMatch(FORBIDDEN);
    expect(stored).toContain('<p>корисний текст</p>');
    // Посилання з javascript: втратило href, текст лишився.
    expect(stored).toContain('клік');
  });

  it('🔴 запис: розділ, опція й товар через generic-write адмінки', async () => {
    const [section] = await sectionsOps.insert({
      data: [
        { id: rnd(), slug: 'xss-section', name: 'Розділ', description: EVIL },
      ],
    });
    const [option] = await propertyOptionsOps.insert({
      data: [
        {
          id: rnd(),
          propertyId,
          slug: 'xss-option',
          name: 'Опція',
          description: EVIL,
        },
      ],
    });
    const [product] = await productsOps.insert({
      data: [
        {
          id: rnd(),
          slug: 'xss-product-2',
          name: 'Товар 2',
          description: EVIL,
        },
      ],
    });
    for (const [table, id] of [
      ['sections', section!.id],
      ['property_options', option!.id],
      ['products', product!.id],
    ] as const) {
      const stored = await scalar(
        `select description from public.${table} where id = $1`,
        [id],
      );
      expect(stored, table).not.toMatch(FORBIDDEN);
      expect(stored, table).toContain('<p>корисний текст</p>');
    }
  });

  it('🔴 запис: update-патч теж очищається, а patch без розмітки не чіпає її', async () => {
    const id = rnd();
    await sectionsOps.insert({
      data: [
        { id, slug: 'xss-update', name: 'Розділ', description: '<p>ok</p>' },
      ],
    });
    await sectionsOps.update({ data: [{ id, patch: { description: EVIL } }] });
    expect(
      await scalar(`select description from public.sections where id = $1`, [
        id,
      ]),
    ).not.toMatch(FORBIDDEN);

    await sectionsOps.update({ data: [{ id, patch: { name: 'Нова назва' } }] });
    expect(
      await scalar(`select description from public.sections where id = $1`, [
        id,
      ]),
    ).toContain('<p>корисний текст</p>');
  });

  // ── Рубіж 2: віддача (рядки, покладені в БД СИРИМИ) ────────────────────────

  it('🔴 віддача: старий сирий відгук віддається очищеним', async () => {
    const legacyAuthor = rnd();
    await seedUser(legacyAuthor);
    await queryRows(
      dbUrl,
      `insert into public.product_reviews (id, product_id, user_id, rating, content, status)
       values ($1, $2, $3, 4, $4, 'approved')`,
      [rnd(), productId, legacyAuthor, EVIL],
    );
    // Рядок у БД — сирий (доказ, що очищення робить саме віддача).
    expect(
      await scalar(
        `select content from public.product_reviews where user_id = $1`,
        [legacyAuthor],
      ),
    ).toBe(EVIL);

    const reviews = await withStorefrontDb((db) =>
      loadProductReviews(db, productId),
    );
    expect(reviews.length).toBeGreaterThan(0);
    for (const review of reviews) {
      expect(review.content ?? '').not.toMatch(FORBIDDEN);
    }
    expect(reviews.some((r) => r.content?.includes('корисний текст'))).toBe(
      true,
    );
  });

  it('🔴 віддача: розділ, товар і опція вітрини — очищені', async () => {
    const sectionId = rnd();
    const rawProductId = rnd();
    const optionId = rnd();
    await queryRows(
      dbUrl,
      `insert into public.sections (id, slug, name, description, is_active)
       values ($1, 'raw-section', 'Сирий', $2, true)`,
      [sectionId, EVIL],
    );
    await queryRows(
      dbUrl,
      `insert into public.products (id, slug, name, description, is_active)
       values ($1, 'raw-product', 'Сирий', $2, true)`,
      [rawProductId, EVIL],
    );
    await queryRows(
      dbUrl,
      `insert into public.property_options (id, property_id, slug, name, description)
       values ($1, $2, 'raw-option', 'Сира', $3)`,
      [optionId, propertyId, EVIL],
    );

    const sections = await withStorefrontDb((db) => loadSections(db));
    const section = sections.find((s) => s.id === sectionId);
    expect(section?.description).toBeTruthy();
    expect(section?.description).not.toMatch(FORBIDDEN);

    const product = await withStorefrontDb((db) =>
      loadProduct(db, 'raw-product'),
    );
    expect(product?.description).toBeTruthy();
    expect(product?.description).not.toMatch(FORBIDDEN);

    const page = await withStorefrontDb((db) =>
      loadPropertyOption(db, 'xss-prop', 'raw-option'),
    );
    expect(page?.option.description).toBeTruthy();
    expect(page?.option.description).not.toMatch(FORBIDDEN);
  });

  it('🔴 віддача: list адмінки віддає очищену розмітку сирого рядка', async () => {
    const id = rnd();
    await queryRows(
      dbUrl,
      `insert into public.sections (id, slug, name, description)
       values ($1, 'raw-admin-section', 'Сирий', $2)`,
      [id, EVIL],
    );
    const rows = await sectionsOps.list({ data: { subset: {} } });
    const row = rows.find((r) => r.id === id);
    expect(row?.description).toBeTruthy();
    expect(row?.description).not.toMatch(FORBIDDEN);
  });

  it('🔴 віддача: розмітка відгуку для модерації очищена', async () => {
    const reviewId = rnd();
    const moderated = rnd();
    await seedUser(moderated);
    await queryRows(
      dbUrl,
      `insert into public.product_reviews (id, product_id, user_id, rating, content)
       values ($1, $2, $3, 3, $4)`,
      [reviewId, productId, moderated, EVIL],
    );
    const { content } = await getReviewContentOp({ data: { reviewId } });
    expect(content).toBeTruthy();
    expect(content).not.toMatch(FORBIDDEN);
    expect(content).toContain('<p>корисний текст</p>');
  });
});
