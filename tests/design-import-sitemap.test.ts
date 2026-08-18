/**
 * Юніти `lib/sitemap.mjs` (інкремент Б.3, Фаза 2 Step 3). До цієї задачі
 * оркестрація візитів була покрита лише CLI-смоком у браузері — тут вона
 * тестується без браузера через інжектовану `visit` (саме заради цього її й
 * інжектують), а разом із нею — форма `schemaVersion: 2` з масивом `links`.
 */
import { describe, expect, it } from 'vitest';
import { buildSitemapProposal } from '../.agents/skills/redesign-from-reference/scripts/lib/sitemap.mjs';

const START = 'https://a.com/';

type Probe = { jsonLdTypes: string[]; cardLinks: number };

/** Fake-visit: 2xx для перелічених URL, провал для решти; лічить виклики. */
function fakeVisit(okUrls: string[]) {
  const calls: string[] = [];
  const visit = async (url: string) => {
    calls.push(url);
    return okUrls.includes(url)
      ? { ok: true, title: `Title of ${url}` }
      : { ok: false };
  };
  return { visit, calls };
}

/**
 * Fake-visit із контент-пробом: усі перелічені URL віддають 2xx, але разом із
 * пробом, який `detectVisitMismatch` може відхилити. Лічить пари (url, type) —
 * саме такою сигнатурою `sitemap.mjs` кличе візит із Фази 3.
 */
function fakeVisitWithProbe(probes: Record<string, Probe>) {
  const calls: Array<[string, string]> = [];
  const visit = async (url: string, type: string) => {
    calls.push([url, type]);
    const probe = probes[url];
    return probe
      ? { ok: true, title: `Title of ${url}`, probe }
      : { ok: false };
  };
  return { visit, calls };
}

const BASE_LINKS = [
  { url: 'https://a.com/', anchors: ['Home'] },
  { url: 'https://a.com/shop', anchors: ['Shop'] },
  { url: 'https://a.com/products/hoodie', anchors: ['Hoodie'] },
];

describe('lib/sitemap.mjs — buildSitemapProposal: форма виводу', () => {
  it('schemaVersion 2, links замість linksSeen, visited/title з візиту', async () => {
    const { visit } = fakeVisit([
      'https://a.com/',
      'https://a.com/shop',
      'https://a.com/products/hoodie',
    ]);
    const proposal = await buildSitemapProposal({
      links: BASE_LINKS,
      startUrl: START,
      maxVisits: 10,
      visit,
    });

    expect(proposal.schemaVersion).toBe(2);
    expect(proposal.startUrl).toBe(START);
    expect(proposal).not.toHaveProperty('linksSeen');
    expect(proposal.pageTypes.listing).toMatchObject({
      url: 'https://a.com/shop',
      visited: true,
      title: 'Title of https://a.com/shop',
    });
    // Типи без жодного кандидата — чесний `no-candidate`, а не мовчання.
    expect(proposal.unresolved).toContainEqual({
      type: 'checkout',
      reason: 'no-candidate',
    });
  });

  it('links: дедуп за нормалізованим pathname, агреговані якорі, сортування', async () => {
    const { visit } = fakeVisit(['https://a.com/', 'https://a.com/shop']);
    const proposal = await buildSitemapProposal({
      links: [
        { url: 'https://a.com/shop?page=2#top', anchors: ['Shop'] },
        { url: 'https://a.com/cart', anchors: ['Cart'] },
        // Той самий pathname іншим написанням лінка — один запис, обидва якорі.
        { url: 'https://a.com/shop/', anchors: ['Каталог', 'Shop'] },
        { url: 'https://a.com/', anchors: [] },
      ],
      startUrl: START,
      maxVisits: 10,
      visit,
    });

    expect(proposal.links).toEqual([
      { pathname: '/', anchors: [] },
      { pathname: '/cart', anchors: ['Cart'] },
      { pathname: '/shop', anchors: ['Shop', 'Каталог'] },
    ]);
  });

  it('links — запис ВХОДУ: сторінка, відхилена перепідбором, з масиву не зникає', async () => {
    // `/about` провалив візит і його виключено з робочого набору — але
    // протокол «що інструмент побачив» має лишитись повним (V-3).
    const { visit } = fakeVisit(['https://a.com/']);
    const proposal = await buildSitemapProposal({
      links: [
        { url: 'https://a.com/', anchors: ['Home'] },
        { url: 'https://a.com/about', anchors: ['About Us'] },
      ],
      startUrl: START,
      maxVisits: 10,
      visit,
    });

    expect(proposal.links.map((link) => link.pathname)).toEqual([
      '/',
      '/about',
    ]);
    expect(proposal.unresolved).toContainEqual({
      type: 'about',
      reason: 'visit-failed',
    });
  });
});

describe('lib/sitemap.mjs — buildSitemapProposal: перепідбір і бюджет', () => {
  it('visit-failed виключає кандидата, і тип бере наступного за score', async () => {
    // `/about-help` — кандидат на about зі score 4 (URL + якір), але 404;
    // після виключення тип має дістатись слабшому `/pro-nas`.
    const { visit, calls } = fakeVisit([
      'https://a.com/',
      'https://a.com/pro-nas',
    ]);
    const proposal = await buildSitemapProposal({
      links: [
        { url: 'https://a.com/', anchors: ['Home'] },
        { url: 'https://a.com/about-help', anchors: ['About Us'] },
        { url: 'https://a.com/pro-nas', anchors: [] },
      ],
      startUrl: START,
      maxVisits: 10,
      visit,
    });

    expect(calls).toContain('https://a.com/about-help');
    expect(proposal.pageTypes.about).toMatchObject({
      url: 'https://a.com/pro-nas',
      visited: true,
    });
    expect(proposal.unresolved.map((entry) => entry.type)).not.toContain(
      'about',
    );
  });

  it('без запасного кандидата тип іде в unresolved із причиною visit-failed', async () => {
    const { visit } = fakeVisit(['https://a.com/']);
    const proposal = await buildSitemapProposal({
      links: [
        { url: 'https://a.com/', anchors: ['Home'] },
        { url: 'https://a.com/shop', anchors: ['Shop'] },
      ],
      startUrl: START,
      maxVisits: 10,
      visit,
    });

    expect(proposal.pageTypes.listing).toBeUndefined();
    expect(proposal.unresolved).toContainEqual({
      type: 'listing',
      reason: 'visit-failed',
    });
  });

  it('бюджет maxVisits спільний на всі типи: понад нього — visited: false', async () => {
    const { visit, calls } = fakeVisit([
      'https://a.com/',
      'https://a.com/shop',
      'https://a.com/products/hoodie',
    ]);
    const proposal = await buildSitemapProposal({
      links: BASE_LINKS,
      startUrl: START,
      maxVisits: 1,
      visit,
    });

    expect(calls).toHaveLength(1);
    const visitedFlags = Object.values(proposal.pageTypes).map(
      (info) => info.visited,
    );
    expect(visitedFlags.filter(Boolean)).toHaveLength(1);
    expect(
      visitedFlags.filter((flag) => flag === false).length,
    ).toBeGreaterThan(0);
    // Кандидат понад бюджет лишається знайденим — просто чесно не відвіданим.
    expect(proposal.pageTypes.product).toMatchObject({ visited: false });
  });
});

describe('lib/sitemap.mjs — buildSitemapProposal: visit-mismatch', () => {
  const HOME_PROBE: Probe = { jsonLdTypes: ['WebSite'], cardLinks: 0 };
  // Сторінка відкрилась (2xx), але це сітка карток без Product-розмітки —
  // прямий регрес кейсу deo: індекс колекції, що забрав тип `product`.
  const GRID_PROBE: Probe = {
    jsonLdTypes: ['CollectionPage', 'ItemList'],
    cardLinks: 12,
  };
  const CARD_PROBE: Probe = { jsonLdTypes: ['Product'], cardLinks: 0 };

  it('кандидат-колекція відхиляється, і тип перепідбирається наступним', async () => {
    // `/products/grid` — сильніший кандидат (URL + якір «Product», score 4),
    // але змістом це список; після відхилення тип має дістатись `/products/hoodie`.
    const { visit, calls } = fakeVisitWithProbe({
      'https://a.com/': HOME_PROBE,
      'https://a.com/products/grid': GRID_PROBE,
      'https://a.com/products/hoodie': CARD_PROBE,
    });
    const proposal = await buildSitemapProposal({
      links: [
        { url: 'https://a.com/', anchors: ['Home'] },
        { url: 'https://a.com/products/grid', anchors: ['Product'] },
        { url: 'https://a.com/products/hoodie', anchors: [] },
      ],
      startUrl: START,
      maxVisits: 10,
      visit,
    });

    // Сигнатура візиту — саме `(url, type)`: без типу проб інтерпретувати нічим.
    expect(calls).toContainEqual(['https://a.com/products/grid', 'product']);
    expect(proposal.pageTypes.product).toMatchObject({
      url: 'https://a.com/products/hoodie',
      visited: true,
    });
    expect(proposal.unresolved.map((entry) => entry.type)).not.toContain(
      'product',
    );
  });

  it('без запасного кандидата — unresolved із причиною visit-mismatch', async () => {
    // Причина мусить відрізнятись від `visit-failed`: сторінка ВІДКРИЛАСЬ,
    // помилився класифікатор, і читач пропозиції має бачити саме це.
    const { visit } = fakeVisitWithProbe({
      'https://a.com/': HOME_PROBE,
      'https://a.com/products/grid': GRID_PROBE,
    });
    const proposal = await buildSitemapProposal({
      links: [
        { url: 'https://a.com/', anchors: ['Home'] },
        { url: 'https://a.com/products/grid', anchors: ['Product'] },
      ],
      startUrl: START,
      maxVisits: 10,
      visit,
    });

    expect(proposal.pageTypes.product).toBeUndefined();
    expect(proposal.unresolved).toContainEqual({
      type: 'product',
      reason: 'visit-mismatch',
    });
  });

  it('2xx без mismatch лишається знайденим — проб не відхиляє «на всяк випадок»', async () => {
    const { visit } = fakeVisitWithProbe({
      'https://a.com/': HOME_PROBE,
      'https://a.com/products/hoodie': CARD_PROBE,
    });
    const proposal = await buildSitemapProposal({
      links: [
        { url: 'https://a.com/', anchors: ['Home'] },
        { url: 'https://a.com/products/hoodie', anchors: [] },
      ],
      startUrl: START,
      maxVisits: 10,
      visit,
    });

    expect(proposal.pageTypes.product).toMatchObject({
      url: 'https://a.com/products/hoodie',
      visited: true,
    });
  });
});
