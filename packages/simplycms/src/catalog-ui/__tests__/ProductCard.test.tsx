// @vitest-environment jsdom
// Посилання картки ведуть на `/<path>` — сторінку сутності з реєстру адрес.
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ProductCard } from '../ProductCard';
import { TestI18nProvider } from '../../../test-harness/i18n';

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

const renderCard = () =>
  render(
    <TestI18nProvider>
      <ProductCard product={{ id: 'p1', name: 'Товар', slug: 'orphan' }} />
    </TestI18nProvider>,
  );

describe('ProductCard: шлях товару', () => {
  // Розділу в пропсах картки немає: адреса — лише поточна адреса мови (`slug`).
  it('веде на сторінку сутності /<path>', () => {
    renderCard();
    expect(screen.getByTestId('card').getAttribute('href')).toBe('/orphan');
  });
});
