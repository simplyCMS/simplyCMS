import { describe, it, expect } from 'vitest';
import { loadHomePageData } from '../home';
import {
  FAIL,
  FEATURED_KEY,
  NEW_KEY,
  makeClient,
  phaseOneCalls,
  sectionCalls,
} from './home-client.mock';

/**
 * Task 0.1: `loadHomePageData` не має ковтати помилку жодного із запитів —
 * при помилці будь-якого з них функція повинна кинути виняток.
 * Task 0.2: фаза 2 — секційні товари тягне саме лоадер (SSR), по одному
 * запиту `limit(8)` на кореневу секцію; результат — мапа `sectionId → товари`.
 *
 * 🔴 Предикати запитів перевіряються поіменно: зникнення `is_active`,
 * `is_featured` чи `parent_id` тихо змінює вміст головної, а не ламає її, —
 * тест, який дивиться лише на кількість запитів, цього не бачить.
 */

const SECTIONS = [
  { id: 's1', name: 'Секція A', slug: 'a' },
  { id: 's2', name: 'Секція B', slug: 'b' },
  { id: 's3', name: 'Секція C', slug: 'c' },
];

/** Рядок товару секційної добірки (сирий вигляд із PostgREST) */
const productRow = (id: string) => ({
  id,
  name: `Товар ${id}`,
  slug: id,
  images: ['/img.jpg'],
  short_description: null,
  stock_status: 'in_stock',
});

describe('loadHomePageData — помилки Supabase не ковтаються', () => {
  it('усі запити успішні → повертає дані', async () => {
    const { client } = makeClient();
    await expect(loadHomePageData(client)).resolves.toEqual({
      banners: [],
      featuredProducts: [],
      newProducts: [],
      sections: [],
      sectionProducts: {},
    });
  });

  it('помилка banners → reject', async () => {
    const { client } = makeClient({ results: { banners: FAIL } });
    await expect(loadHomePageData(client)).rejects.toBeTruthy();
  });

  it('помилка добірки featured → reject', async () => {
    const { client } = makeClient({ results: { [FEATURED_KEY]: FAIL } });
    await expect(loadHomePageData(client)).rejects.toBeTruthy();
  });

  it('помилка добірки новинок → reject', async () => {
    const { client } = makeClient({ results: { [NEW_KEY]: FAIL } });
    await expect(loadHomePageData(client)).rejects.toBeTruthy();
  });

  it('помилка sections → reject', async () => {
    const { client } = makeClient({ results: { sections: FAIL } });
    await expect(loadHomePageData(client)).rejects.toBeTruthy();
  });
});

describe('loadHomePageData — предикати запитів', () => {
  it('фаза 1: таблиця + повний набір фільтрів кожного запиту', async () => {
    const { client, calls } = makeClient({ rootSections: SECTIONS });
    await loadHomePageData(client);

    const phase1 = phaseOneCalls(calls).map(({ table, eq, is }) => ({
      table,
      eq,
      is,
    }));
    expect(phase1).toEqual([
      { table: 'banners', eq: { is_active: true }, is: {} },
      { table: 'products', eq: { is_active: true, is_featured: true }, is: {} },
      { table: 'products', eq: { is_active: true }, is: {} },
      { table: 'sections', eq: { is_active: true }, is: { parent_id: null } },
    ]);
  });
});

describe('loadHomePageData — фаза 2: секційні товари в SSR', () => {
  it('3 кореневі секції → рівно 3 запити з limit(8)', async () => {
    const { client, calls } = makeClient({ rootSections: SECTIONS });
    await loadHomePageData(client);

    const phase2 = sectionCalls(calls);
    expect(phase2).toHaveLength(3);
    expect(phase2.map((call) => call.eq)).toEqual([
      { is_active: true, section_id: 's1' },
      { is_active: true, section_id: 's2' },
      { is_active: true, section_id: 's3' },
    ]);
    expect(phase2.every((call) => call.limit === 8)).toBe(true);
    expect(phase2.every((call) => call.table === 'products')).toBe(true);
  });

  it('повернення містить мапу з ключами всіх трьох секцій', async () => {
    const { client } = makeClient({
      rootSections: SECTIONS,
      bySection: {
        s1: { data: [productRow('p1')], error: null },
        s2: { data: [productRow('p2')], error: null },
        s3: { data: [], error: null },
      },
    });

    const data = await loadHomePageData(client);
    expect(Object.keys(data.sectionProducts).sort()).toEqual([
      's1',
      's2',
      's3',
    ]);
    expect(data.sectionProducts.s1).toEqual([
      {
        id: 'p1',
        name: 'Товар p1',
        slug: 'p1',
        images: ['/img.jpg'],
        short_description: null,
        stock_status: 'in_stock',
        section: { slug: 'a' },
      },
    ]);
    expect(data.sectionProducts.s3).toEqual([]);
  });

  it('помилка одного секційного запиту → reject', async () => {
    const { client } = makeClient({
      rootSections: SECTIONS,
      bySection: { s2: FAIL },
    });
    await expect(loadHomePageData(client)).rejects.toBeTruthy();
  });
});
