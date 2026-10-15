import { describe, expect, it } from 'vitest';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { createLocaleRewrite, type LocaleRewriteState } from '../rewrite';
import type { LocaleSet } from '../resolve';

const SET: LocaleSet = {
  primary: 'uk',
  published: ['uk', 'en'],
  known: ['uk', 'en'],
};

function input(rewrite: ReturnType<typeof createLocaleRewrite>, path: string) {
  const url = new URL(path, 'http://localhost');
  const out = rewrite.input!({ url });
  const result = out === undefined ? url : new URL(out);
  return result.pathname + result.search;
}
function output(rewrite: ReturnType<typeof createLocaleRewrite>, path: string) {
  const url = new URL(path, 'http://localhost');
  const out = rewrite.output!({ url });
  const result = out === undefined ? url : new URL(out);
  return result.pathname + result.search;
}

function setup(current = 'uk') {
  const state: LocaleRewriteState = { current };
  return { state, rewrite: createLocaleRewrite(SET, state) };
}

describe('createLocaleRewrite', () => {
  it('input("/en/cart") → /cart, state.current = en', () => {
    const { state, rewrite } = setup();
    expect(input(rewrite, '/en/cart')).toBe('/cart');
    expect(state.current).toBe('en');
  });

  it('input основної мови без префікса пише основну', () => {
    const { state, rewrite } = setup('en');
    expect(input(rewrite, '/cart')).toBe('/cart');
    expect(state.current).toBe('uk');
  });

  it('output("/cart") при current = en → /en/cart; корінь → /en (без слеша)', () => {
    const { rewrite } = setup('en');
    expect(output(rewrite, '/cart')).toBe('/en/cart');
    expect(output(rewrite, '/')).toBe('/en');
  });

  it('output при основній мові — без змін', () => {
    const { rewrite } = setup('uk');
    expect(output(rewrite, '/cart')).toBe('/cart');
  });

  it('query зберігається в обидва боки', () => {
    const { rewrite } = setup('en');
    expect(input(rewrite, '/en/x?a=1')).toBe('/x?a=1');
    expect(output(rewrite, '/x?a=1')).toBe('/en/x?a=1');
  });

  it.each([
    '/admin/x',
    '/api/v1/a.b',
    '/_serverFn/x',
    '/assets/a.js',
    '/media/a.png',
  ])('%s незмінний в обидва боки і не чіпає state', (path) => {
    const { state, rewrite } = setup('en');
    expect(input(rewrite, path)).toBe(path);
    expect(output(rewrite, path)).toBe(path);
    expect(state.current).toBe('en');
  });

  it('/en/admin: перший сегмент мова, тож це вітринний шлях, а не адмінка', () => {
    const { rewrite } = setup();
    expect(input(rewrite, '/en/admin')).toBe('/admin');
  });

  it('output∘input — тотожне на 10 канонічних URL', () => {
    const urls = [
      '/',
      '/cart',
      '/catalog',
      '/checkout',
      '/auth/login',
      '/my/orders/42',
      '/profile',
      '/order-success/abc',
      '/some-product',
      '/section/sub-section?page=2&sort=name',
    ];
    for (const lang of ['en', 'uk']) {
      for (const path of urls) {
        const { rewrite } = setup();
        const prefixed =
          lang === 'uk' ? path : path === '/' ? '/en' : `/en${path}`;
        expect(output(rewrite, input(rewrite, prefixed))).toBe(prefixed);
      }
    }
  });
});

describe('createLocaleRewrite у справжньому роутері (router-core)', () => {
  function build(initial: string) {
    const root = createRootRoute();
    const cart = createRoute({ getParentRoute: () => root, path: '/cart' });
    const index = createRoute({ getParentRoute: () => root, path: '/' });
    const state: LocaleRewriteState = { current: SET.primary };
    return createRouter({
      routeTree: root.addChildren([index, cart]),
      history: createMemoryHistory({ initialEntries: [initial] }),
      rewrite: createLocaleRewrite(SET, state),
    });
  }

  it('/en/cart: внутрішній шлях /cart, публічна адреса зберігає префікс', () => {
    const router = build('/en/cart');
    expect(router.latestLocation.pathname).toBe('/cart');
    expect(router.latestLocation.publicHref).toBe('/en/cart');
    expect(router.buildLocation({ to: '/cart' }).publicHref).toBe('/en/cart');
    expect(router.buildLocation({ to: '/' }).publicHref).toBe('/en');
  });

  it('/cart: основна мова, посилання без префікса', () => {
    const router = build('/cart');
    expect(router.latestLocation.pathname).toBe('/cart');
    expect(router.buildLocation({ to: '/cart' }).publicHref).toBe('/cart');
  });

  it('канонічна адреса збігається з публічною: роутер не редіректить /en/cart і /en', () => {
    for (const path of ['/en/cart', '/en']) {
      const router = build(path);
      const canonical = router.buildLocation({
        to: router.latestLocation.pathname,
        search: true,
        params: true,
        hash: true,
        state: true,
      });
      expect(canonical.publicHref).toBe(router.latestLocation.publicHref);
    }
  });
});
