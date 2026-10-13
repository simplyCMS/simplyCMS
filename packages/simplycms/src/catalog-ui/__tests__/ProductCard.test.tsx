// @vitest-environment jsdom
// Р25: посилання картки ведуть на шлях, який роут товару вважає канонічним.
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { I18nProvider } from 'simplycms/i18n';
import { productRedirectTarget } from 'simplycms/domain';
import { ProductCard } from '../ProductCard';

vi.mock('@tanstack/react-router', () => ({
  // Підставляє params у патерн так, як це робить роутер.
  Link: ({
    to,
    params,
    children,
  }: {
    to: string;
    params: Record<string, string>;
    children: ReactNode;
  }) => (
    <a
      href={to.replace(/\$(\w+)/g, (_, k: string) => params[k] ?? '')}
      data-testid="card"
    >
      {children}
    </a>
  ),
}));
vi.mock('simplycms/react-query', () => ({
  useFormatPrice: () => (n: number) => String(n),
}));

afterEach(cleanup);

const renderCard = (section: { slug: string } | null) =>
  render(
    <I18nProvider locale="uk">
      <ProductCard
        product={{ id: 'p1', name: 'Товар', slug: 'orphan', section }}
      />
    </I18nProvider>,
  );

describe('ProductCard: шлях товару', () => {
  it('🔴 без розділу → /catalog/all/<slug>, який роут не редіректить (не 404)', () => {
    renderCard(null);
    const href = screen.getByTestId('card').getAttribute('href')!;
    expect(href).toBe('/catalog/all/orphan');
    const [, , segment, slug] = href.split('/');
    expect(
      productRedirectTarget({ slug: slug!, sectionSlug: null }, segment!),
    ).toBeNull();
  });

  it('з розділом → /catalog/<розділ>/<slug>', () => {
    renderCard({ slug: 'shoes' });
    expect(screen.getByTestId('card').getAttribute('href')).toBe(
      '/catalog/shoes/orphan',
    );
  });
});
