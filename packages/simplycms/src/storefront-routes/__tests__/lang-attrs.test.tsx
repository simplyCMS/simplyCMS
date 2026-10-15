// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, render, screen } from '@testing-library/react';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import type { RouterContext } from 'simplycms/runtime';
import { dirOf, htmlLangAttrs } from '../locale/lang-attrs';
import { loadStorefrontRoot, resolveRouterLocales } from '../locale/root-data';
import { RootNotFound } from '../locale/RootNotFound';
import { createLocaleRewrite } from '../locale/rewrite';
import { NO_LOCALES, type LocaleSet } from '../locale/resolve';

// `getStorefrontRoot` — serverFn з БД; тут важлива лише мова, тож його дані
// підмінено порожнім коренем.
vi.mock('../server/root', () => ({
  getStorefrontRoot: async () => ({
    activeThemeName: 'default',
    storeProfile: { name: 'Shop' },
    siteUrl: '',
  }),
}));

vi.mock('simplycms/storefront/loaders', () => ({
  loadLocaleSet: async () => ({
    primary: 'uk',
    published: ['uk', 'en', 'ar'],
    known: ['uk', 'en', 'ar'],
  }),
}));

const SET: LocaleSet = {
  primary: 'uk',
  published: ['uk', 'en', 'ar'],
  known: ['uk', 'en', 'ar'],
};

/** `<html>` так, як його розгортає кореневий роут host-а. */
const htmlOf = (locale: string) =>
  renderToStaticMarkup(<html {...htmlLangAttrs(locale)} />);

describe('<html lang dir> (І37)', () => {
  it('SSR root на /en/x → lang="en" dir="ltr"', async () => {
    const data = await loadStorefrontRoot('/en/x', SET);
    expect(data.locale).toBe('en');
    expect(data.languages).toEqual({
      primary: 'uk',
      published: ['uk', 'en', 'ar'],
    });
    expect(htmlOf(data.locale)).toContain('lang="en"');
    expect(htmlOf(data.locale)).toContain('dir="ltr"');
  });

  it('SSR root на /x → основна мова', async () => {
    const data = await loadStorefrontRoot('/x?a=1', SET);
    expect(data.locale).toBe('uk');
    expect(htmlOf(data.locale)).toContain('lang="uk"');
  });

  it('права-ліва мова → dir="rtl" без колонки в БД', async () => {
    const data = await loadStorefrontRoot('/ar/x', SET);
    expect(htmlOf(data.locale)).toContain('lang="ar"');
    expect(htmlOf(data.locale)).toContain('dir="rtl"');
  });

  it('dirOf: ltr, rtl, а нерозбірливий код не валить кореневу розмітку', () => {
    expect(dirOf('en')).toBe('ltr');
    expect(dirOf('he')).toBe('rtl');
    expect(dirOf('not a locale!!')).toBe('ltr');
  });
});

afterEach(cleanup);

describe('NotFound і мова запиту поза I18nProvider', () => {
  function renderAt(path: string) {
    const root = createRootRouteWithContext<RouterContext>()({
      notFoundComponent: RootNotFound,
    });
    const index = createRoute({ getParentRoute: () => root, path: '/' });
    const router = createRouter({
      routeTree: root.addChildren([index]),
      history: createMemoryHistory({ initialEntries: [path] }),
      rewrite: createLocaleRewrite(SET, { current: SET.primary }),
      context: { locales: SET } as RouterContext,
    });
    return render(<RouterProvider router={router} />);
  }

  it('404 на /en/x має англійський текст', async () => {
    renderAt('/en/x');
    expect(await screen.findByText('Page not found')).toBeTruthy();
    expect(screen.getByText('Back to home')).toBeTruthy();
  });

  it('404 на /x — мова магазину', async () => {
    renderAt('/x');
    expect(await screen.findByText('Сторінку не знайдено')).toBeTruthy();
  });

  it('запит без нормалізації (404 під /api, /assets): набір мов дочитано лінивo, текст перекладений', async () => {
    const root = createRootRouteWithContext<RouterContext>()({
      beforeLoad: async ({ context }) => ({
        locales: await resolveRouterLocales(context.locales),
      }),
      notFoundComponent: RootNotFound,
    });
    const router = createRouter({
      routeTree: root.addChildren([]),
      history: createMemoryHistory({ initialEntries: ['/api/nope'] }),
      context: { locales: NO_LOCALES } as RouterContext,
    });
    render(<RouterProvider router={router} />);
    expect(await screen.findByText('Сторінку не знайдено')).toBeTruthy();
    expect(screen.getByText('На головну')).toBeTruthy();
  });

  it('посилання «на головну» веде на головну тієї ж мови', async () => {
    renderAt('/en/x');
    const link = await screen.findByText('Back to home');
    expect(link.closest('a')?.getAttribute('href')).toBe('/en');
  });
});
