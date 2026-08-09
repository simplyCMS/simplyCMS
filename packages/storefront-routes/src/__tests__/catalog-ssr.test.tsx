import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '@simplycms/i18n';

/**
 * Task 16, Step 3: списки товарів мають бути в серверному HTML.
 * Рендеримо сторінки через renderToString (жодних ефектів → React Query ще
 * порожній) і перевіряємо, що назва І ЦІНА товару вже присутні в розмітці.
 */

/** Підставляє $param-плейсхолдери в шлях — щоб перевіряти й href картки. */
function buildHref(to: string, params?: Record<string, string>): string {
  if (!params) return to;
  return Object.entries(params).reduce(
    (acc, [key, value]) => acc.replaceAll(`$${key}`, value),
    to,
  );
}

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    children: ReactNode;
    to: string;
    params?: Record<string, string>;
  }) => <a href={buildHref(to, params)}>{children}</a>,
  useParams: () => ({ sectionSlug: 'invertory' }),
}));

vi.mock('@simplycms/supabase/SupabaseProvider', () => ({
  useSupabaseClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({}) }) }),
  }),
}));

vi.mock('@simplycms/core/hooks/useAuth', () => ({
  useAuth: () => ({ user: null }),
}));

import CatalogPage from '../pages/Catalog';
import CatalogSectionPage, {
  type CatalogSectionPageProps,
} from '../pages/CatalogSection';
import {
  toProductListItem,
  type PriceContext,
  type ProductListRow,
} from '../server/product-list-item';

const ctx: PriceContext = { defaultPriceTypeId: 'pt-default' };

/** Рядок у формі реального select-у каталогу */
const fixtureRow: ProductListRow = {
  id: 'prod-1',
  slug: 'invertor-5kw',
  name: 'Інвертор 5 кВт SSR',
  images: ['https://cdn.example.com/invertor.jpg'],
  has_modifications: true,
  sections: { slug: 'invertory' },
  product_modifications: [{ id: 'mod-b', is_default: true, sort_order: 1 }],
  product_prices: [
    {
      price_type_id: 'pt-default',
      price: 4200,
      old_price: null,
      modification_id: 'mod-b',
    },
  ],
};

const items = [toProductListItem(fixtureRow, ctx)];

const sectionFixture = {
  id: 'sec-1',
  name: 'Інвертори',
  slug: 'invertory',
  description: null,
} as unknown as NonNullable<CatalogSectionPageProps['initialSection']>;

function ssr(node: ReactNode): string {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  // I18nProvider — як у проді (`__root.tsx` тримає його над усіма роутами):
  // канонічні сторінки ходять по рядки через `useT()`, тож без провайдера
  // рендер падає ще до перевірки SSR-повноти.
  return renderToString(
    <QueryClientProvider client={client}>
      <I18nProvider locale="uk">{node}</I18nProvider>
    </QueryClientProvider>,
  );
}

describe('SSR-повнота списків товарів', () => {
  it('Catalog рендерить назву й ціну товару в серверному HTML', () => {
    const html = ssr(<CatalogPage initialProducts={items} />);

    expect(html).toContain('Інвертор 5 кВт SSR');
    expect(html).toMatch(/4[\s ]*200/);
    expect(html).toContain('₴');
    expect(html).toContain('/catalog/invertory/invertor-5kw');
  });

  it('CatalogSection рендерить назву й ціну товару в серверному HTML', () => {
    const html = ssr(
      <CatalogSectionPage
        sectionSlug="invertory"
        initialSection={sectionFixture}
        initialProducts={items}
      />,
    );

    expect(html).toContain('Інвертор 5 кВт SSR');
    expect(html).toMatch(/4[\s ]*200/);
    expect(html).toContain('₴');
    expect(html).toContain('/catalog/invertory/invertor-5kw');
  });
});
