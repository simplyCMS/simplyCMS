/**
 * Юніти класифікатора `lib/classify.mjs` (задача §2.C.2, план — Фаза 2
 * Step 2): чиста функція без браузера — усі кейси з плану.
 */
import { describe, expect, it } from 'vitest';
import {
  classifyLinks,
  normalizePathname,
} from '../scripts/design-import/lib/classify.mjs';

const REASON = 'no-candidate';

describe('lib/classify.mjs — normalizePathname', () => {
  it('прибирає query/hash, trailing slash і index.html', () => {
    expect(normalizePathname('https://a.com/shop/')).toBe('/shop');
    expect(normalizePathname('https://a.com/shop/index.html')).toBe('/shop');
    expect(normalizePathname('https://a.com/shop?x=1#top')).toBe('/shop');
    expect(normalizePathname('https://a.com/')).toBe('/');
    expect(normalizePathname('https://a.com')).toBe('/');
  });

  it('те саме для відносного pathname (без origin)', () => {
    expect(normalizePathname('/shop/')).toBe('/shop');
    expect(normalizePathname('/index.html')).toBe('/');
  });
});

describe('lib/classify.mjs — classifyLinks', () => {
  it('англомовний набір: усі 7 типів класифіковані', () => {
    const startUrl = 'https://a.com/';
    const { pageTypes, unresolved } = classifyLinks(
      [
        { url: 'https://a.com/shop', anchors: ['Shop'] },
        { url: 'https://a.com/products/hoodie', anchors: ['Hoodie'] },
        { url: 'https://a.com/cart', anchors: ['Cart'] },
        { url: 'https://a.com/checkout', anchors: ['Checkout'] },
        { url: 'https://a.com/contact', anchors: ['Contact'] },
        { url: 'https://a.com/about', anchors: ['About'] },
      ],
      startUrl,
    );
    expect(unresolved).toEqual([]);
    expect(pageTypes.home.url).toBe(startUrl);
    expect(pageTypes.listing.url).toBe('https://a.com/shop');
    expect(pageTypes.product.url).toBe('https://a.com/products/hoodie');
    expect(pageTypes.cart.url).toBe('https://a.com/cart');
    expect(pageTypes.checkout.url).toBe('https://a.com/checkout');
    expect(pageTypes.contact.url).toBe('https://a.com/contact');
    expect(pageTypes.about.url).toBe('https://a.com/about');
  });

  it('українськомовний набір (транслітерація в URL + кирилиця в якорях)', () => {
    const startUrl = 'https://a.com.ua/';
    const { pageTypes, unresolved } = classifyLinks(
      [
        { url: 'https://a.com.ua/katalog', anchors: ['Каталог'] },
        { url: 'https://a.com.ua/tovary/futbolka', anchors: ['Футболка'] },
        { url: 'https://a.com.ua/korzyna', anchors: ['Кошик'] },
        {
          url: 'https://a.com.ua/oformlennya',
          anchors: ['Оформлення замовлення'],
        },
        { url: 'https://a.com.ua/kontakty', anchors: ['Контакти'] },
        { url: 'https://a.com.ua/pro-nas', anchors: ['Про нас'] },
      ],
      startUrl,
    );
    expect(unresolved).toEqual([]);
    expect(pageTypes.listing.url).toBe('https://a.com.ua/katalog');
    expect(pageTypes.product.url).toBe('https://a.com.ua/tovary/futbolka');
    expect(pageTypes.cart).toMatchObject({
      url: 'https://a.com.ua/korzyna',
      score: 4,
    });
    expect(pageTypes.checkout).toMatchObject({ score: 4 });
    expect(pageTypes.contact).toMatchObject({ score: 4 });
    expect(pageTypes.about).toMatchObject({ score: 4 });
  });

  it('якір-only сторінка (/koshyk + «Кошик») класифікується без збігу URL-патерну', () => {
    const { pageTypes } = classifyLinks(
      [{ url: 'https://a.com/koshyk', anchors: ['Кошик'] }],
      'https://a.com/',
    );
    expect(pageTypes.cart).toEqual({
      url: 'https://a.com/koshyk',
      score: 2,
      evidence: [{ anchorMatch: 'Кошик', source: 'anchor' }],
    });
  });

  it('іконковий лінк без видимого тексту класифікується через агрегований aria-label', () => {
    // Р3b: `anchors` тут — уже агреговані discover.mjs тексти лінка; для
    // іконки без textContent це буде єдиний запис, узятий з aria-label.
    const { pageTypes } = classifyLinks(
      [{ url: 'https://a.com/nav-item-3', anchors: ['Кошик'] }],
      'https://a.com/',
    );
    expect(pageTypes.cart.url).toBe('https://a.com/nav-item-3');
    expect(pageTypes.cart.evidence).toEqual([
      { anchorMatch: 'Кошик', source: 'anchor' },
    ]);
  });

  it('конфлікт двох типів на одному URL: вищий score виграє, програвший перепідбирає наступного кандидата', () => {
    const { pageTypes } = classifyLinks(
      [
        {
          url: 'https://a.com/about-help',
          anchors: ['About Us', 'Контакти'],
        },
        { url: 'https://a.com/support', anchors: ['Контакти'] },
      ],
      'https://a.com/',
    );
    // about: url-патерн (/about) + якір «About Us» → score 4, забирає /about-help.
    expect(pageTypes.about).toMatchObject({
      url: 'https://a.com/about-help',
      score: 4,
    });
    // contact: якір-only на тому самому URL програє — перепідбирає /support.
    expect(pageTypes.contact).toMatchObject({
      url: 'https://a.com/support',
      score: 2,
    });
  });

  it('порожній список лінків: home — фолбек на стартовий URL, решта unresolved', () => {
    const { pageTypes, unresolved } = classifyLinks([], 'https://a.com/random');
    expect(pageTypes.home).toEqual({
      url: 'https://a.com/random',
      score: 0,
      evidence: [{ source: 'url' }],
    });
    expect(unresolved).toHaveLength(6);
  });

  it('home — корінь origin, якщо він серед лінків, навіть коли старт не корінь', () => {
    const { pageTypes } = classifyLinks(
      [{ url: 'https://a.com/', anchors: ['Home'] }],
      'https://a.com/random',
    );
    expect(pageTypes.home).toEqual({
      url: 'https://a.com/',
      score: 2,
      evidence: [{ urlPattern: '/', source: 'url' }],
    });
  });

  it('unresolved містить причину no-candidate для кожного нерозпізнаного типу', () => {
    const { unresolved } = classifyLinks([], 'https://a.com/');
    expect(unresolved.length).toBeGreaterThan(0);
    for (const entry of unresolved) {
      expect(entry.reason).toBe(REASON);
      expect(typeof entry.type).toBe('string');
    }
  });
});
