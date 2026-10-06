import { describe, expect, it } from 'vitest';
import type { StorefrontProfile } from 'simplycms/contracts/store-profile';
import {
  homeHead,
  readStorefrontRoot,
  storefrontHead,
  type StorefrontRootData,
} from '../head/head';

/**
 * `head()` роутів вітрини бере назву магазину й локаль із кореневого лоадера
 * host-а (Е6б-10). Тут — правило заголовка й поведінка на зіпсованому профілі
 * (Review Focus 1: порожня назва не дає « — » на кінці заголовка).
 */

const PROFILE: StorefrontProfile = {
  name: 'Крамниця',
  homeTitle: null,
  description: 'Опис магазину',
  contacts: { phone: null, email: null, address: null, hours: null },
  logoUrl: null,
  socials: [],
};

function rootMatches(profile: StorefrontProfile, locale = 'uk-UA') {
  const data: StorefrontRootData = {
    activeThemeName: 'default',
    storeProfile: profile,
    siteUrl: 'https://shop.example',
    locale,
  };
  return [
    { routeId: '__root__', loaderData: data },
    { routeId: '/_storefront', loaderData: { themeName: 'default' } },
    { routeId: '/_storefront/cart', loaderData: undefined },
  ];
}

function titleOf(head: ReturnType<typeof storefrontHead>): unknown {
  return head.meta.find((m) => 'title' in m)?.title;
}

function descriptionOf(head: ReturnType<typeof storefrontHead>): unknown {
  const meta = head.meta.find((m) => 'name' in m && m.name === 'description');
  return meta && 'content' in meta ? meta.content : undefined;
}

describe('storefrontHead', () => {
  it('сторінка + назва магазину → «Сторінка — Назва» через i18n', () => {
    const head = storefrontHead(rootMatches(PROFILE), (t) => ({
      title: t('cart.title'),
    }));
    expect(titleOf(head)).toBe('Кошик — Крамниця');
  });

  it('порожня назва магазину → лише назва сторінки, без « — »', () => {
    const head = storefrontHead(rootMatches({ ...PROFILE, name: '' }), (t) => ({
      title: t('cart.title'),
    }));
    expect(titleOf(head)).toBe('Кошик');
  });

  it('сторінка без власного заголовка → назва магазину', () => {
    const head = storefrontHead(rootMatches(PROFILE), () => ({}));
    expect(titleOf(head)).toBe('Крамниця');
  });

  it('локаль із кореня: en-каталог дає англійську назву сторінки', () => {
    const head = storefrontHead(rootMatches(PROFILE, 'en-US'), (t) => ({
      title: t('cart.title'),
    }));
    expect(titleOf(head)).toBe('Cart — Крамниця');
  });

  it('опису сторінки немає → опис профілю', () => {
    const head = storefrontHead(rootMatches(PROFILE), () => ({
      title: 'X',
      description: null,
    }));
    expect(descriptionOf(head)).toBe('Опис магазину');
  });

  it('опис сторінки має пріоритет над описом профілю', () => {
    const head = storefrontHead(rootMatches(PROFILE), () => ({
      description: 'Опис сторінки',
    }));
    expect(descriptionOf(head)).toBe('Опис сторінки');
  });

  it('немає жодного опису → meta description не виводиться', () => {
    const head = storefrontHead(
      rootMatches({ ...PROFILE, description: null }),
      () => ({}),
    );
    expect(descriptionOf(head)).toBeUndefined();
  });
});

describe('homeHead', () => {
  it('homeTitle віддається як є, без суфікса назви магазину', () => {
    const head = homeHead({ ...PROFILE, homeTitle: 'Сонячні панелі в Києві' });
    expect(titleOf(head)).toBe('Сонячні панелі в Києві');
    expect(descriptionOf(head)).toBe('Опис магазину');
  });

  it('без homeTitle → назва магазину', () => {
    expect(titleOf(homeHead(PROFILE))).toBe('Крамниця');
  });
});

describe('readStorefrontRoot', () => {
  it('віддає дані кореневого матчу', () => {
    expect(readStorefrontRoot(rootMatches(PROFILE)).storeProfile.name).toBe(
      'Крамниця',
    );
  });

  it('немає кореневих даних → кидає з підказкою про host', () => {
    expect(() =>
      readStorefrontRoot([{ routeId: '/_storefront', loaderData: {} }]),
    ).toThrow(/__root\.tsx/);
    expect(() =>
      readStorefrontRoot([
        { routeId: '__root__', loaderData: { activeThemeName: 'default' } },
      ]),
    ).toThrow(/getStorefrontRoot/);
  });
});
