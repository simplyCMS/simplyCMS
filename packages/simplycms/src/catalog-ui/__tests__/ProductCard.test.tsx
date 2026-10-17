// @vitest-environment jsdom
// Посилання картки ведуть на `/<path>` — сторінку сутності з реєстру адрес.
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { I18nProvider } from 'simplycms/i18n';
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
    <a href={to.replace('$path', params.path ?? '')} data-testid="card">
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
  it('веде на сторінку сутності /<path>, розділ у шляху не бере участі', () => {
    renderCard(null);
    expect(screen.getByTestId('card').getAttribute('href')).toBe('/orphan');
  });

  it('товар з розділом має ту саму адресу: розділ не частина URL товару', () => {
    renderCard({ slug: 'shoes' });
    expect(screen.getByTestId('card').getAttribute('href')).toBe('/orphan');
  });
});
