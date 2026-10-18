import { describe, expect, it } from 'vitest';
import type { StorefrontProfile } from 'simplycms/contracts/store-profile';
import type { StorefrontRootData } from '../head/head';
import { productHead, type ProductHeadInput } from '../head/product';

/**
 * `head()` картки товару: canonical, hreflang і `url` JSON-LD будуються від
 * `siteUrl` кореня й результату політики індексації (`page.seo`); без `siteUrl`
 * їх немає (а не відносні чи `example.com`).
 */

const PROFILE: StorefrontProfile = {
  name: 'Крамниця',
  homeTitle: null,
  description: null,
  contacts: { phone: null, email: null, address: null, hours: null },
  logoUrl: null,
  socials: [],
};

const PRODUCT: ProductHeadInput = {
  name: 'Панель',
  description: null,
  images: [{ url: '/media/panel.jpg', alt: 'Панель' }],
  stock_status: 'in_stock',
  has_modifications: false,
  product_modifications: [],
  product_prices: [
    {
      price_type_id: 'retail',
      modification_id: null,
      price: 100,
      old_price: null,
    },
  ],
  guest_price_types: { priceTypeId: 'retail', defaultPriceTypeId: 'retail' },
  page: {
    locale: 'uk',
    seo: {
      robots: 'index, follow',
      canonical: '/panel',
      hreflang: [
        { hrefLang: 'uk', href: '/panel' },
        { hrefLang: 'en', href: '/en/panel-en' },
        { hrefLang: 'x-default', href: '/panel' },
      ],
    },
  },
};

function matches(siteUrl: string) {
  const data: StorefrontRootData = {
    activeThemeName: 'default',
    storeProfile: PROFILE,
    siteUrl,
    locale: 'uk',
    languages: { primary: 'uk', published: ['uk', 'en'] },
  };
  return [{ routeId: '__root__', loaderData: data }];
}

function jsonLd(head: ReturnType<typeof productHead>): Record<string, unknown> {
  return JSON.parse(head.scripts[0]!.children) as Record<string, unknown>;
}

function content(head: ReturnType<typeof productHead>, key: string): unknown {
  const m = head.meta.find(
    (x) =>
      ('name' in x && x.name === key) ||
      ('property' in x && x.property === key),
  );
  return m && 'content' in m ? m.content : undefined;
}

const titleOf = (head: ReturnType<typeof productHead>): unknown => {
  const titled = head.meta.find((m) => 'title' in m);
  return titled && 'title' in titled ? titled.title : null;
};

describe('productHead', () => {
  it('порожній siteUrl → без canonical, hreflang і url у JSON-LD', () => {
    const head = productHead(matches(''), PRODUCT);
    expect(head.links).toEqual([]);
    expect(jsonLd(head)).not.toHaveProperty('url');
  });

  it('з siteUrl → canonical, hreflang із x-default і url від адреси з реєстру', () => {
    const head = productHead(matches('https://shop.example'), PRODUCT);
    expect(head.links).toEqual([
      { rel: 'canonical', href: 'https://shop.example/panel' },
      { rel: 'alternate', hrefLang: 'uk', href: 'https://shop.example/panel' },
      {
        rel: 'alternate',
        hrefLang: 'en',
        href: 'https://shop.example/en/panel-en',
      },
      {
        rel: 'alternate',
        hrefLang: 'x-default',
        href: 'https://shop.example/panel',
      },
    ]);
    expect(jsonLd(head).url).toBe('https://shop.example/panel');
  });

  it('ручний canonical на інший сайт лишається абсолютним', () => {
    const head = productHead(matches('https://shop.example'), {
      ...PRODUCT,
      page: {
        ...PRODUCT.page,
        seo: {
          ...PRODUCT.page.seo,
          canonical: 'https://other.example/p',
          hreflang: [],
        },
      },
    });
    expect(head.links).toEqual([
      { rel: 'canonical', href: 'https://other.example/p' },
    ]);
  });

  it('robots і og:locale — мовою версії; pt-BR → pt_BR', () => {
    const head = productHead(matches(''), {
      ...PRODUCT,
      page: {
        locale: 'pt-BR',
        seo: { ...PRODUCT.page.seo, robots: 'noindex, follow' },
      },
    });
    expect(content(head, 'robots')).toBe('noindex, follow');
    expect(content(head, 'og:locale')).toBe('pt_BR');
  });

  it('опис без власного тексту товару — i18n-шаблон, однаковий у meta і og', () => {
    const head = productHead(matches(''), PRODUCT);
    expect(content(head, 'description')).toBe('Купити Панель');
    expect(content(head, 'og:description')).toBe('Купити Панель');
    expect(titleOf(head)).toBe('Панель — Крамниця');
  });

  it('meta_title і meta_description мають пріоритет над назвою й описом', () => {
    const head = productHead(matches(''), {
      ...PRODUCT,
      meta_title: 'Сонячна панель 450 Вт',
      meta_description: 'Мета-опис',
      short_description: 'Короткий',
      description: '<p>Довгий</p>',
    });
    expect(titleOf(head)).toBe('Сонячна панель 450 Вт — Крамниця');
    expect(content(head, 'description')).toBe('Мета-опис');
    expect(content(head, 'og:title')).toBe('Сонячна панель 450 Вт');
  });

  it('опис із HTML → у meta description, og:description і JSON-LD без тегів', () => {
    const head = productHead(matches(''), {
      ...PRODUCT,
      description: '<p>Опис <b>x</b></p>',
    });
    expect(content(head, 'description')).toBe('Опис x');
    expect(content(head, 'og:description')).toBe('Опис x');
    expect(jsonLd(head).description).toBe('Опис x');
  });
});
