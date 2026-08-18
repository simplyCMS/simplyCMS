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
import { describe, expect, it } from 'vitest';
import { browserVisitProbe } from '../.agents/skills/redesign-from-reference/scripts/lib/visit-probe.mjs';

/** 1×1 gif — щоб `img` був справжнім вузлом, а не мережевим запитом. */
const PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

function render(html: string) {
  document.body.innerHTML = html;
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
  it('рахує лінки із зображенням, що ведуть ГЛИБШЕ за поточну сторінку', () => {
    // jsdom стоїть на корені (`/`), тож усе односегментне вже глибше.
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

  it('лінк тієї самої або меншої глибини — навігація, не картка', () => {
    // Глибина рахується СЕГМЕНТАМИ: сторінка на корені має глибину 0, тож
    // навігаційний `/` (теж 0) відсікається, а односегментна картка — ні.
    render(`${card('/')}${card('/product')}`);
    expect(browserVisitProbe().cardLinks).toBe(1);
  });
});
