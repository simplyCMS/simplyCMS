import { describe, expect, it } from 'vitest';
import type { StorefrontProfile } from 'simplycms/contracts/store-profile';
import type { StorefrontRootData } from '../head/head';
import { productHead, type ProductHeadInput } from '../head/product';

/**
 * `head()` картки товару: canonical і `url` JSON-LD будуються від `siteUrl`
 * кореня; без нього обидва відсутні (а не відносні чи `example.com`).
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
  slug: 'panel',
  description: null,
  images: ['/media/panel.jpg'],
  stock_status: 'in_stock',
  product_prices: [{ modification_id: null, price: 100 }],
};

function matches(siteUrl: string) {
  const data: StorefrontRootData = {
    activeThemeName: 'default',
    storeProfile: PROFILE,
    siteUrl,
    locale: 'uk-UA',
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

describe('productHead', () => {
  it('порожній siteUrl → без canonical і без url у JSON-LD', () => {
    const head = productHead(matches(''), PRODUCT, 'solar');
    expect(head.links).toEqual([]);
    expect(jsonLd(head)).not.toHaveProperty('url');
  });

  it('з siteUrl → canonical і url від нормалізованої адреси', () => {
    const head = productHead(matches('https://shop.example'), PRODUCT, 'solar');
    const url = 'https://shop.example/catalog/solar/panel';
    expect(head.links).toEqual([{ rel: 'canonical', href: url }]);
    expect(jsonLd(head).url).toBe(url);
  });

  it('опис без власного тексту товару — i18n-шаблон, однаковий у meta і og', () => {
    const head = productHead(matches(''), PRODUCT, 'solar');
    expect(content(head, 'description')).toBe('Купити Панель');
    expect(content(head, 'og:description')).toBe('Купити Панель');
    const titled = head.meta.find((m) => 'title' in m);
    expect(titled && 'title' in titled ? titled.title : null).toBe(
      'Панель — Крамниця',
    );
  });
});
