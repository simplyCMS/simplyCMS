// @vitest-environment jsdom
/**
 * Юніти БРАУЗЕРНОЇ половини контент-проба (інкремент Б.3, Фаза 3, план Р5):
 * `browserVisitProbe` із `lib/visit-probe.mjs`. Окремий файл, а не блок у
 * `design-import-visit-probe.test.ts`, саме тому, що вимагає DOM: чиста
 * частина має лишатись зеленою в `node`-оточенні без жодного натяку на
 * сторінковий контекст.
 *
 * 🔴 jsdom тут — дублер сторінкового контексту, не Playwright: у живому
 * прогоні цю ж функцію серіалізують у chromium (`page.evaluate`), і саме
 * тому вона не має замикань. CLI-смок `design-import-discover-cli` доводить,
 * що вона й у справжньому браузері не падає; тут перевіряються самі виміри.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  browserVisitProbe,
  detectVisitMismatch,
  GRID_CARDS_MIN,
} from '../.agents/skills/redesign-from-reference/scripts/lib/visit-probe.mjs';

/** 1×1 gif — щоб `img` був справжнім вузлом, а не мережевим запитом. */
const PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

function render(html: string) {
  // 🔴 Голова теж чиститься: фікстурні тести нижче підміняють увесь документ,
  // а `browserVisitProbe` читає JSON-LD по ВСЬОМУ документу — залишок розмітки
  // від попереднього тесту мовчки зіпсував би вимір наступного.
  document.head.innerHTML = '';
  document.body.innerHTML = html;
}

/** Підмінити pathname сторінки, у контексті якої «виконується» проб. */
function at(pathname: string) {
  history.replaceState(null, '', pathname);
}

/** Замінити ВЕСЬ документ фікстурою — JSON-LD у `<head>` теж має потрапити в проб. */
function renderDocument(html: string) {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  document.documentElement.replaceWith(
    document.importNode(parsed.documentElement, true),
  );
}

function card(href: string) {
  return `<a href="${href}"><img src="${PIXEL}" alt="card" /></a>`;
}

describe('lib/visit-probe.mjs — browserVisitProbe: jsonLdTypes', () => {
  it('розгортає масив, @graph і вкладеність ItemList → item', () => {
    render(`
      <script type="application/ld+json">
        [{ "@type": "BreadcrumbList" }, { "@graph": [{ "@type": "WebSite" }] }]
      </script>
      <script type="application/ld+json">
        {
          "@type": "CollectionPage",
          "mainEntity": {
            "@type": "ItemList",
            "itemListElement": [
              { "@type": "ListItem", "item": { "@type": "Product" } }
            ]
          }
        }
      </script>
    `);

    expect(browserVisitProbe().jsonLdTypes).toEqual([
      'BreadcrumbList',
      'WebSite',
      'CollectionPage',
      'ItemList',
      'ListItem',
      'Product',
    ]);
  });

  it('масив у @type і битий JSON: перше зараховується, друге ковтається тихо', () => {
    render(`
      <script type="application/ld+json">{ "@type": ["Product", "Offer"] }</script>
      <script type="application/ld+json">{ це не JSON }</script>
    `);

    // Битий JSON-LD — не помилка візиту: розмітка ламається на живих сайтах
    // постійно, і валити через це кандидата було б грубіше за саму помилку.
    expect(browserVisitProbe().jsonLdTypes).toEqual(['Product', 'Offer']);
  });

  it('сторінка без розмітки — порожній масив, а не крах', () => {
    render('<h1>Nothing here</h1>');
    expect(browserVisitProbe().jsonLdTypes).toEqual([]);
  });
});

describe('lib/visit-probe.mjs — browserVisitProbe: cardLinks', () => {
  it('рахує лінки із зображенням, що ділять батьківський префікс', () => {
    // Навігація (`/`, `/product`) картинок не має і в сімʼю не потрапляє.
    at('/');
    render(`
      <nav><a href="/">Home</a><a href="/product">Product</a></nav>
      ${card('/product/a')}${card('/product/b')}${card('/product/c')}
    `);
    expect(browserVisitProbe().cardLinks).toBe(3);
  });

  it('лінк без зображення карткою не рахується', () => {
    render(`<a href="/product/a">Текстовий лінк</a>${card('/product/b')}`);
    expect(browserVisitProbe().cardLinks).toBe(1);
  });

  it('чужий origin не рахується — це банер, а не картка каталогу', () => {
    render(`${card('https://partner.example/promo')}${card('/product/a')}`);
    expect(browserVisitProbe().cardLinks).toBe(1);
  });

  it('лінк на саму поточну сторінку не рахується — це логотип чи крихти', () => {
    at('/collections/all');
    render(`${card('/collections/all/')}${card('/products/a')}`);
    expect(browserVisitProbe().cardLinks).toBe(1);
  });

  it('береться НАЙБІЛЬША сімʼя однопрефіксних лінків, а не їх сума', () => {
    // Різнорідне іконкове меню (`/cart`, `/about`, `/blog`) ділить префікс `/`
    // і дає групу з трьох; сітка каталогу — свою, з чотирьох. Лічильник має
    // віддати чотири, а не сім: він міряє повторюваність, не кількість картинок.
    at('/collections/all');
    render(`
      ${card('/cart')}${card('/about')}${card('/blog')}
      ${card('/products/a')}${card('/products/b')}
      ${card('/products/c')}${card('/products/d')}
    `);
    expect(browserVisitProbe().cardLinks).toBe(4);
  });

  it('картка з двома лінками (фото + бейдж) лишається однією карткою', () => {
    at('/collections/all');
    render(
      `${card('/products/a')}${card('/products/a')}${card('/products/b')}`,
    );
    expect(browserVisitProbe().cardLinks).toBe(2);
  });
});

describe('lib/visit-probe.mjs — регрес: глибина сторінки не впливає на cardLinks', () => {
  // 🔴 Прямий регрес знахідки рев'ю (дефект 1). Стара умова «лінк веде ГЛИБШЕ
  // за поточну сторінку» перевертала цю НЕЗМІНЕНУ фікстуру самим лише URL:
  // під `/product` вона давала 6 карток, а під двома найпоширенішими
  // розкладками — Shopify `/collections/all` і WooCommerce
  // `/product-category/<cat>`, де індекс і картки лежать на ОДНАКОВІЙ
  // глибині, — рівний нуль, і тип `listing` їхав в unresolved.
  const COLLECTION = readFileSync(
    join(
      process.cwd(),
      'tests/fixtures/design-import/site-singular/collection.html',
    ),
    'utf8',
  );

  for (const pathname of [
    '/product',
    '/collections/all',
    '/product-category/watches/',
    '/shop',
  ]) {
    it(`${pathname}: шість карток видно, mismatch(listing) немає`, () => {
      at(pathname);
      renderDocument(COLLECTION);
      const probe = browserVisitProbe();

      expect(probe.cardLinks).toBe(6);
      expect(probe.cardLinks).toBeGreaterThanOrEqual(GRID_CARDS_MIN);
      expect(detectVisitMismatch('listing', probe)).toBe(false);
    });
  }

  it('та сама розкладка без Product-розмітки викриває помилковий тип product', () => {
    // Дзеркальна половина фікса: індекс і картки на однаковій глибині, нуль
    // JSON-LD — саме кейс deo, і правило `product` тепер його бачить.
    at('/product-category/watches');
    render(
      ['a', 'b', 'c', 'd', 'e', 'f'].map((s) => card(`/product/${s}`)).join(''),
    );
    const probe = browserVisitProbe();

    expect(probe.cardLinks).toBe(6);
    expect(detectVisitMismatch('product', probe)).toBe(true);
  });
});
