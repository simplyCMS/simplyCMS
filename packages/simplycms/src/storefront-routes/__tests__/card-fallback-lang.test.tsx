// @vitest-environment jsdom
// М1 Task 16: ознака fallback назви доходить до картки обома шляхами — серверним списком
// (`SsrProductGrid`) і картками головної (`toCardViewModel`): без неї скрінрідер читав би
// назву основної мови вимовою мови сторінки (І37).
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { I18nProvider } from 'simplycms/i18n';
import { ProductCard } from 'simplycms/catalog-ui/ProductCard';
import { SsrProductGrid } from '../components/SsrProductGrid';
import { toCardViewModel } from '../pages/home/toCardViewModel';
import type { HomeProduct } from '../pages/home/types';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/x">{children}</a>,
}));
vi.mock('simplycms/react-query', () => ({
  useFormatPrice: () => (n: number) => String(n),
}));

afterEach(cleanup);

const langOf = (text: string) =>
  screen.getByText(text).closest('[lang]')?.getAttribute('lang') ?? null;

describe('fallback-назва картки', () => {
  it('SsrProductGrid: nameLang елемента списку → lang назви картки', () => {
    render(
      <I18nProvider locale="en">
        <SsrProductGrid
          viewMode="grid"
          items={[
            {
              id: 'p1',
              slug: 'rozetka',
              name: 'Розетка',
              nameLang: 'uk',
              image: null,
              price: null,
            },
            {
              id: 'p2',
              slug: 'cable',
              name: 'Cable',
              nameLang: null,
              image: null,
              price: null,
            },
          ]}
        />
      </I18nProvider>,
    );

    expect(langOf('Розетка')).toBe('uk');
    expect(langOf('Cable')).toBeNull();
  });

  it('картки головної: name_lang і short_description_lang переходять у view-model і в розмітку', () => {
    const product: HomeProduct = {
      id: 'p1',
      name: 'Розетка',
      slug: 'rozetka',
      images: [],
      short_description: 'Подвійна розетка',
      name_lang: 'uk',
      short_description_lang: 'uk',
      stock_status: 'in_stock',
      section: null,
      section_id: null,
      price: 10,
      old_price: null,
      prices: [],
    };
    const [card] = toCardViewModel([product], undefined);

    expect(card).toMatchObject({
      name_lang: 'uk',
      short_description_lang: 'uk',
    });
    render(
      <I18nProvider locale="en">
        <ProductCard product={card!} />
      </I18nProvider>,
    );
    expect(langOf('Розетка')).toBe('uk');
    expect(langOf('Подвійна розетка')).toBe('uk');
  });
});

// М1 Task 17б: мініатюра картки — фото мовою сторінки з даних (`toGallery`), не назва товару.
describe('мініатюра картки: alt і його мова з даних', () => {
  const img = () => screen.getByRole('img', { hidden: true });

  it('SsrProductGrid: fallback alt основної мови → lang на самому <img>', () => {
    render(
      <I18nProvider locale="en">
        <SsrProductGrid
          viewMode="grid"
          items={[
            {
              id: 'p1',
              slug: 'cable',
              name: 'Cable',
              nameLang: null,
              image: { url: '/media/c.png', alt: 'Кабель', alt_lang: 'uk' },
              price: null,
            },
          ]}
        />
      </I18nProvider>,
    );
    expect(img().getAttribute('src')).toBe('/media/c.png');
    expect(img().getAttribute('alt')).toBe('Кабель');
    expect(img().getAttribute('lang')).toBe('uk');
  });

  it('alt мовою сторінки — без lang; фото без alt — alt="", а не назва товару', () => {
    const { unmount } = render(
      <I18nProvider locale="en">
        <ProductCard
          product={{
            id: 'p1',
            name: 'Cable',
            slug: 'cable',
            images: [{ url: '/media/c.png', alt: 'Cable front' }],
          }}
        />
      </I18nProvider>,
    );
    expect(img().getAttribute('alt')).toBe('Cable front');
    expect(img().hasAttribute('lang')).toBe(false);
    unmount();

    const { container } = render(
      <I18nProvider locale="en">
        <ProductCard
          product={{
            id: 'p1',
            name: 'Cable',
            slug: 'cable',
            images: [{ url: '/media/c.png', alt: '' }],
          }}
        />
      </I18nProvider>,
    );
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('');
  });
});
