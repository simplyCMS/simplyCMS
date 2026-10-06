import { describe, expect, it } from 'vitest';
import type { StorefrontProfile } from 'simplycms/contracts/store-profile';
import { buildOrganizationJsonLd } from '../head/organization';

/**
 * Organization JSON-LD головної (Е6б-10, «Додатково» Review Focus): назва
 * власника потрапляє в `<script>` сирим текстом, тож `</script>` у ній не
 * сміє закрити тег; порожній `VITE_SITE_URL` не дає відносних `url`/`logo`.
 */

const PROFILE: StorefrontProfile = {
  name: 'Крамниця',
  homeTitle: null,
  description: null,
  contacts: {
    phone: '+380441234567',
    email: 'shop@example.com',
    address: null,
    hours: 'Пн–Пт 9–18',
  },
  logoUrl: '/media/logo.png',
  socials: [
    { network: 'telegram', url: 'https://t.me/shop' },
    { network: 'instagram', url: 'https://instagram.com/shop' },
  ],
};

function parse(children: string): Record<string, unknown> {
  return JSON.parse(children) as Record<string, unknown>;
}

describe('buildOrganizationJsonLd', () => {
  it('серіалізує профіль у schema.org Organization', () => {
    const script = buildOrganizationJsonLd(PROFILE, 'https://shop.example');
    expect(script.type).toBe('application/ld+json');
    expect(parse(script.children)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Крамниця',
      url: 'https://shop.example',
      logo: 'https://shop.example/media/logo.png',
      telephone: '+380441234567',
      email: 'shop@example.com',
      sameAs: ['https://t.me/shop', 'https://instagram.com/shop'],
    });
  });

  it('назва з </script> не закриває тег: кожен < екрановано', () => {
    const script = buildOrganizationJsonLd(
      { ...PROFILE, name: 'A</script><b>' },
      'https://shop.example',
    );
    expect(script.children).not.toContain('</script>');
    expect(script.children).not.toContain('<');
    expect(script.children).toContain('\\u003c/script>');
    expect(parse(script.children).name).toBe('A</script><b>');
  });

  it('порожній siteUrl → немає ні url, ні logo', () => {
    const data = parse(buildOrganizationJsonLd(PROFILE, '').children);
    expect(data).not.toHaveProperty('url');
    expect(data).not.toHaveProperty('logo');
    expect(data.name).toBe('Крамниця');
  });

  it('siteUrl із кінцевим / → logo без подвійного слеша', () => {
    const data = parse(
      buildOrganizationJsonLd(PROFILE, 'https://shop.example/').children,
    );
    expect(data.logo).toBe('https://shop.example/media/logo.png');
  });

  it('абсолютний logoUrl лишається як є, не склеюється з siteUrl', () => {
    const data = parse(
      buildOrganizationJsonLd(
        { ...PROFILE, logoUrl: 'https://cdn.example/logo.png' },
        'https://shop.example',
      ).children,
    );
    expect(data.logo).toBe('https://cdn.example/logo.png');
  });

  it('порожні поля профілю не серіалізуються', () => {
    const data = parse(
      buildOrganizationJsonLd(
        {
          ...PROFILE,
          contacts: { phone: null, email: null, address: null, hours: null },
          logoUrl: null,
          socials: [],
        },
        'https://shop.example',
      ).children,
    );
    expect(Object.keys(data).sort()).toEqual(
      ['@context', '@type', 'name', 'url'].sort(),
    );
  });

  it('адреса й sameAs у порядку профілю', () => {
    const data = parse(
      buildOrganizationJsonLd(
        {
          ...PROFILE,
          contacts: { ...PROFILE.contacts, address: 'Київ, вул. Хрещатик, 1' },
        },
        'https://shop.example',
      ).children,
    );
    expect(data.address).toBe('Київ, вул. Хрещатик, 1');
    expect(data.sameAs).toEqual([
      'https://t.me/shop',
      'https://instagram.com/shop',
    ]);
  });
});
