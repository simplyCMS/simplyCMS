/**
 * Юніти класифікатора `lib/classify.mjs` (задача §2.C.2, план — Фаза 2
 * Step 2): чиста функція без браузера — усі кейси з плану.
 */
import { describe, expect, it } from 'vitest';
import {
  classifyLinks,
  normalizePathname,
} from '../.agents/skills/redesign-from-reference/scripts/lib/classify.mjs';

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

/**
 * Дискаверер v2 (інкремент Б.3, Фаза 1): розширені словники платформ і
 * type-aware тайбрейк. Конфліктні сегменти (`product(s)`/`item(s)`/`tovar(y)`)
 * мають ДВІ ролі — bare-форма це індекс каталогу, форма з дитиною це картка.
 */
describe('lib/classify.mjs — дискаверер v2: конфліктні сегменти і тайбрейк', () => {
  it('bare /product → listing, /product/<slug> → product (лише URL-патерни)', () => {
    const { pageTypes } = classifyLinks(
      [
        { url: 'https://a.com/product' },
        { url: 'https://a.com/product/deo-x1' },
      ],
      'https://a.com/',
    );
    expect(pageTypes.listing.url).toBe('https://a.com/product');
    expect(pageTypes.product.url).toBe('https://a.com/product/deo-x1');
  });

  it('те саме для транслітерації: /tovary і /tovar → listing, /tovar/<slug> → product', () => {
    const plural = classifyLinks(
      [
        { url: 'https://a.com/tovary' },
        { url: 'https://a.com/tovary/futbolka' },
      ],
      'https://a.com/',
    );
    expect(plural.pageTypes.listing.url).toBe('https://a.com/tovary');
    expect(plural.pageTypes.product.url).toBe('https://a.com/tovary/futbolka');

    const singular = classifyLinks(
      [{ url: 'https://a.com/tovar' }, { url: 'https://a.com/tovar/futbolka' }],
      'https://a.com/',
    );
    expect(singular.pageTypes.listing.url).toBe('https://a.com/tovar');
    expect(singular.pageTypes.product.url).toBe('https://a.com/tovar/futbolka');
  });

  it('сімʼя літерних маркерів p<id> у сегменті → product (Rozetka/Ecwid/Prom-legacy)', () => {
    const rozetka = classifyLinks(
      [{ url: 'https://a.com/p123456-slug' }],
      'https://a.com/',
    );
    expect(rozetka.pageTypes.product.url).toBe('https://a.com/p123456-slug');

    const prom = classifyLinks(
      [{ url: 'https://a.com/nazva-tovaru-p123' }],
      'https://a.com/',
    );
    expect(prom.pageTypes.product.url).toBe('https://a.com/nazva-tovaru-p123');
  });

  it('патерни платформ: product-category → listing, product-page і <slug>/p → product', () => {
    const woo = classifyLinks(
      [{ url: 'https://a.com/product-category/deodorants' }],
      'https://a.com/',
    );
    expect(woo.pageTypes.listing.url).toBe(
      'https://a.com/product-category/deodorants',
    );
    expect(woo.pageTypes.product).toBeUndefined();

    const wix = classifyLinks(
      [{ url: 'https://a.com/product-page/omega-speedmaster' }],
      'https://a.com/',
    );
    expect(wix.pageTypes.product.url).toBe(
      'https://a.com/product-page/omega-speedmaster',
    );

    const vtex = classifyLinks(
      [{ url: 'https://a.com/omega-speedmaster/p' }],
      'https://a.com/',
    );
    expect(vtex.pageTypes.product.url).toBe(
      'https://a.com/omega-speedmaster/p',
    );

    // Негативний контроль ревʼю Б.3: службовий односегментний хвіст `/p`
    // (без дефісного слага перед ним) карткою не вважається.
    const service = classifyLinks(
      [{ url: 'https://a.com/help/p' }],
      'https://a.com/',
    );
    expect(service.pageTypes.product).toBeUndefined();
  });

  it('кейс deo: /product із якорем «Product» лишається listing, картка бере product', () => {
    // Регрес живого прогону №2: індекс колекції забирав тип `product` через
    // якір «Product» + тайбрейк «коротший виграє».
    const { pageTypes, unresolved } = classifyLinks(
      [
        { url: 'https://a.com/product', anchors: ['Product'] },
        { url: 'https://a.com/product/deo-x1', anchors: ['Deo X1 Deodorant'] },
      ],
      'https://a.com/',
    );
    expect(pageTypes.listing.url).toBe('https://a.com/product');
    expect(pageTypes.product.url).toBe('https://a.com/product/deo-x1');
    expect(unresolved.map((u) => u.type)).not.toContain('listing');
  });

  it('російськомовні якорі каталогу → listing (кирилиця проходить normalizeText)', () => {
    const categories = classifyLinks(
      [{ url: 'https://a.ru/kategorii', anchors: ['Категории'] }],
      'https://a.ru/',
    );
    expect(categories.pageTypes.listing).toMatchObject({
      url: 'https://a.ru/kategorii',
      score: 2,
      evidence: [{ anchorMatch: 'Категории', source: 'anchor' }],
    });

    const assortment = classifyLinks(
      [{ url: 'https://a.ru/razdel', anchors: ['Ассортимент'] }],
      'https://a.ru/',
    );
    expect(assortment.pageTypes.listing.url).toBe('https://a.ru/razdel');

    // `товары` містить `ы` — контроль діапазону `а-я` у фільтрі normalizeText.
    const goods = classifyLinks(
      [{ url: 'https://a.ru/spisok', anchors: ['Товары'] }],
      'https://a.ru/',
    );
    expect(goods.pageTypes.listing.url).toBe('https://a.ru/spisok');
  });

  it('НЕГАТИВНИЙ КОНТРОЛЬ Р2: без type-aware тайбрейка product забрав би мілкий /product', () => {
    // listing закритий окремим `/catalog` (score 4), тож на рівному балі 2
    // змагаються лише пари типу product: мілка `/product` і глибока картка.
    // Зі старим компаратором (`a.pathname.length - b.pathname.length`) виграла
    // б мілка — тест червоніє при відкаті Р2.
    const { pageTypes } = classifyLinks(
      [
        { url: 'https://a.com/catalog', anchors: ['Catalog'] },
        { url: 'https://a.com/product', anchors: ['Product'] },
        { url: 'https://a.com/product/deo-x1', anchors: ['Deo X1'] },
      ],
      'https://a.com/',
    );
    expect(pageTypes.listing).toMatchObject({
      url: 'https://a.com/catalog',
      score: 4,
    });
    expect(pageTypes.product.url).toBe('https://a.com/product/deo-x1');
  });
});

/**
 * Структурний сигнал fan-out (інкремент Б.3, Фаза 2 Step 2): словник знає
 * слова, структура знає форму сайту. Сегменти тут НАВМИСНО нейтральні — жодне
 * зі слів не входить у `classify-terms.mjs`, тож типи закриваються виключно
 * структурою.
 */
describe('lib/classify.mjs — дискаверер v2: структурний сигнал fan-out', () => {
  it('нейтральний префікс із трьома дітьми → listing, лист → product (без словника)', () => {
    const { pageTypes } = classifyLinks(
      [
        { url: 'https://a.com/wares', anchors: ['Wares'] },
        { url: 'https://a.com/wares/alpha', anchors: ['Alpha'] },
        { url: 'https://a.com/wares/beta', anchors: ['Beta'] },
        { url: 'https://a.com/wares/gamma', anchors: ['Gamma'] },
      ],
      'https://a.com/',
    );
    expect(pageTypes.listing).toEqual({
      url: 'https://a.com/wares',
      score: 2,
      evidence: [
        { structural: 'prefix-fanout', count: 3, source: 'structure' },
      ],
    });
    // Серед трьох рівноцінних листів виграє лексикографічно перший — вибір
    // детермінований, а не «як прийшло».
    expect(pageTypes.product).toEqual({
      url: 'https://a.com/wares/alpha',
      score: 2,
      evidence: [{ structural: 'fanout-leaf', source: 'structure' }],
    });
  });

  it('НЕГАТИВНИЙ КОНТРОЛЬ fan-out: із двома дітьми типи не закриваються', () => {
    // Той самий набір без третьої дитини — сигналу немає, обидва типи
    // лишаються unresolved. Вимкнення fan-out червонить попередній тест.
    const { pageTypes, unresolved } = classifyLinks(
      [
        { url: 'https://a.com/wares', anchors: ['Wares'] },
        { url: 'https://a.com/wares/alpha', anchors: ['Alpha'] },
        { url: 'https://a.com/wares/beta', anchors: ['Beta'] },
      ],
      'https://a.com/',
    );
    expect(pageTypes.listing).toBeUndefined();
    expect(pageTypes.product).toBeUndefined();
    expect(unresolved.map((u) => u.type)).toEqual(
      expect.arrayContaining(['listing', 'product']),
    );
  });

  it('структура складається зі словником: /product із трьома картками → listing score 4', () => {
    // Кейс deo в повній силі: bare-форма (URL-патерн) + fan-out дають індексу
    // 4 бали, а картки беруть product зі структури навіть без якорів.
    const { pageTypes } = classifyLinks(
      [
        { url: 'https://a.com/product', anchors: ['Product'] },
        { url: 'https://a.com/product/deo-x1' },
        { url: 'https://a.com/product/deo-x2' },
        { url: 'https://a.com/product/deo-x3' },
      ],
      'https://a.com/',
    );
    expect(pageTypes.listing).toMatchObject({
      url: 'https://a.com/product',
      score: 4,
    });
    expect(pageTypes.listing.evidence).toContainEqual({
      structural: 'prefix-fanout',
      count: 3,
      source: 'structure',
    });
    expect(pageTypes.product.url).toBe('https://a.com/product/deo-x1');
  });
});

describe('lib/classify.mjs — classifyLinks: блокування пар (тип, pathname)', () => {
  // 🔴 Третій параметр — фікс рев'ю (дефект 5): контент-проб візиту
  // (`lib/sitemap.mjs`) спростовує ПАРУ, а не сторінку. Дефолт порожній, тож
  // усі виклики вище лишаються валідними без змін.
  const LINKS = [
    { url: 'https://a.com/', anchors: ['Home'] },
    { url: 'https://a.com/product', anchors: ['Product'] },
  ];

  it('без блокування однина `/product` дістається типу product', () => {
    const { pageTypes } = classifyLinks(LINKS, 'https://a.com/');
    expect(pageTypes.product.url).toBe('https://a.com/product');
  });

  it('заблокована пара не пропонується, а сторінка лишається іншим типам', () => {
    const { pageTypes, unresolved } = classifyLinks(
      LINKS,
      'https://a.com/',
      new Map([['/product', new Set(['product'])]]),
    );

    // Тип, якому сторінку спростовано, більше її не бачить…
    expect(unresolved.map((entry) => entry.type)).toContain('product');
    // …а сама сторінка нікуди не зникла — її бере listing.
    expect(pageTypes.listing.url).toBe('https://a.com/product');
  });

  it('блокування ВСІХ типів сторінки лишає її просто некласифікованою', () => {
    // Саме це й гарантує термінацію циклу перепідбору в `lib/sitemap.mjs`:
    // заблокована пара не може бути запропонована вдруге.
    const { pageTypes, unresolved } = classifyLinks(
      LINKS,
      'https://a.com/',
      new Map([['/product', new Set(['product', 'listing'])]]),
    );

    expect(pageTypes.product).toBeUndefined();
    expect(pageTypes.listing).toBeUndefined();
    expect(unresolved.map((entry) => entry.type)).toEqual(
      expect.arrayContaining(['product', 'listing']),
    );
  });
});
