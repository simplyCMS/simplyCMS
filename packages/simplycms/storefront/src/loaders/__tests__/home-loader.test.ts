import { describe, it, expect } from 'vitest';
import { loadHomePageData } from '../home';
import { FAIL, makeClient, sectionCalls } from './home-client.mock';

/**
 * Task 0.1: `loadHomePageData` не має ковтати помилку жодного із запитів —
 * при помилці будь-якого з них функція повинна кинути виняток.
 * Task 0.2: фаза 2 — секційні товари тягне саме лоадер (SSR), по одному
 * запиту `limit(8)` на кореневу секцію; результат — мапа `sectionId → товари`.
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

  it('помилка products (featured/new) → reject', async () => {
    const { client } = makeClient({ results: { products: FAIL } });
    await expect(loadHomePageData(client)).rejects.toBeTruthy();
  });

  it('помилка sections → reject', async () => {
    const { client } = makeClient({ results: { sections: FAIL } });
    await expect(loadHomePageData(client)).rejects.toBeTruthy();
  });
});

describe('loadHomePageData — фаза 2: секційні товари в SSR', () => {
  it('3 кореневі секції → рівно 3 запити з limit(8)', async () => {
    const { client, calls } = makeClient({ rootSections: SECTIONS });
    await loadHomePageData(client);

    const phase2 = sectionCalls(calls);
    expect(phase2).toHaveLength(3);
    expect(phase2.map((call) => call.eq.section_id)).toEqual([
      's1',
      's2',
      's3',
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
