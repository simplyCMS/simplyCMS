// @vitest-environment jsdom
// М1 Task 16: картка списку НЕ-основної мови веде на адресу ЦІЄЇ мови (`/en/<path en>`), а
// fallback-текст картки несе `lang` основної мови (І37). Link — справжній, з rewrite роутера.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { I18nProvider } from 'simplycms/i18n';
import {
  createLocaleRewrite,
  type LocaleRewriteState,
} from '../locale/rewrite';
import { ProductCard } from 'simplycms/catalog-ui/ProductCard';

vi.mock('simplycms/react-query', () => ({
  useFormatPrice: () => (n: number) => String(n),
}));

afterEach(cleanup);

const SET = { primary: 'uk', published: ['uk', 'en'], known: ['uk', 'en'] };

async function renderAt(
  url: string,
  product: Parameters<typeof ProductCard>[0]['product'],
) {
  const root = createRootRoute({
    component: () => <ProductCard product={product} />,
  });
  const entity = createRoute({ getParentRoute: () => root, path: '/$path' });
  const catalog = createRoute({ getParentRoute: () => root, path: '/catalog' });
  const state: LocaleRewriteState = { current: SET.primary };
  const router = createRouter({
    routeTree: root.addChildren([entity, catalog]),
    history: createMemoryHistory({ initialEntries: [url] }),
    rewrite: createLocaleRewrite(SET, state),
  });
  await router.load();
  render(
    <I18nProvider locale={url.startsWith('/en') ? 'en' : 'uk'}>
      <RouterProvider router={router} />
    </I18nProvider>,
  );
  return screen.findByRole('link');
}

describe('ProductCard: адреса і мова тексту', () => {
  it('картка на /en/catalog веде на /en/<адреса en>, а не на адресу основної мови', async () => {
    // `slug` картки — поточна адреса у мові списку (лоадер читає її з проєкції).
    const link = await renderAt('/en/catalog', {
      id: 'p1',
      name: 'Cable',
      slug: 'cable',
    });
    expect(link.getAttribute('href')).toBe('/en/cable');
  });

  it('картка на основній мові веде на /<адреса> без префікса', async () => {
    const link = await renderAt('/catalog', {
      id: 'p1',
      name: 'Кабель',
      slug: 'kabel',
    });
    expect(link.getAttribute('href')).toBe('/kabel');
  });

  it('fallback-назва і короткий опис обгорнуті lang основної мови; перекладене — без обгортки', async () => {
    await renderAt('/en/catalog', {
      id: 'p1',
      name: 'Розетка',
      name_lang: 'uk',
      short_description: 'Подвійна розетка',
      short_description_lang: 'uk',
      slug: 'rozetka',
    });
    expect(
      screen.getByText('Розетка').closest('[lang]')?.getAttribute('lang'),
    ).toBe('uk');
    expect(
      screen
        .getByText('Подвійна розетка')
        .closest('[lang]')
        ?.getAttribute('lang'),
    ).toBe('uk');
  });

  it('без ознаки fallback текст не отримує lang', async () => {
    await renderAt('/en/catalog', {
      id: 'p1',
      name: 'Cable',
      short_description: 'Copper cable',
      slug: 'cable',
    });
    expect(screen.getByText('Cable').closest('[lang]')).toBeNull();
    expect(screen.getByText('Copper cable').closest('[lang]')).toBeNull();
  });
});
