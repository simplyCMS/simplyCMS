// @vitest-environment jsdom
/**
 * Панелі-сателіти (`SimpleProductPanel`) — СИБЛІНГИ `<form>` картки, не
 * нащадки: `Button` ядра без `type` усередині форми сабмітив би картку.
 * Негативний контроль — DOM-структура.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { I18nProvider } from 'simplycms/i18n';
import { ResizeObserverStub } from './test-engine-stub';
import { aggregate, ID, LANGUAGES } from './ProductEditPage-fixtures';

vi.stubGlobal('ResizeObserver', ResizeObserverStub);
const mocks = vi.hoisted(() => ({
  getProduct: vi.fn(),
  listLanguages: vi.fn(),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock(mocks),
);
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }));
vi.mock('simplycms/core/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock('../../../../components/RichTextEditor', () => ({
  RichTextEditor: () => null,
}));

import { ProductEditPage } from '../ProductEditPage';

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <I18nProvider locale="uk">{children}</I18nProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getProduct.mockResolvedValue(aggregate(false));
  mocks.listLanguages.mockResolvedValue(LANGUAGES);
});
afterEach(() => cleanup());

describe('ProductEditPage: панелі — сиблінги форми, не нащадки', () => {
  it('кнопка «Зберегти ціни» (SimpleProductPanel) — НЕ нащадок <form> картки', async () => {
    const { container } = render(<ProductEditPage productId={ID} />, {
      wrapper,
    });
    const saveButton = await waitFor(() =>
      screen.getByRole('button', { name: 'Зберегти ціни' }),
    );
    const cardForm = container.querySelector('form');
    expect(cardForm).not.toBeNull();
    expect(saveButton.closest('form')).not.toBe(cardForm);
  });

  it('невалідний id (стара закладка) — «не знайдено» без запиту', async () => {
    render(<ProductEditPage productId="not-a-uuid" />, { wrapper });
    await screen.findByText('Товар не знайдено');
    expect(mocks.getProduct).not.toHaveBeenCalled();
  });
});
