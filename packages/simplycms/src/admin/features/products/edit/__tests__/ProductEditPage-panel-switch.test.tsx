// @vitest-environment jsdom
/**
 * Панель-сателіт перемикається за ЗБЕРЕЖЕНИМ станом товару (`base.hasModifications`
 * з `products.get`), не за незбереженим перемикачем форми: клік по типу БЕЗ
 * збереження панель не підмінює, збереження з перечитуванням — підмінює.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { I18nProvider } from 'simplycms/i18n';
import { EngineProvider } from 'simplycms/react-query';
import { ENGINE, ResizeObserverStub } from './test-engine-stub';
import { aggregate, ID, LANGUAGES } from './ProductEditPage-fixtures';

vi.stubGlobal('ResizeObserver', ResizeObserverStub);
const mocks = vi.hoisted(() => ({
  getProduct: vi.fn(),
  listLanguages: vi.fn(),
  saveProductDescription: vi.fn(),
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
      <EngineProvider value={ENGINE}>
        <I18nProvider locale="uk">{children}</I18nProvider>
      </EngineProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getProduct.mockResolvedValue(aggregate(false));
  mocks.listLanguages.mockResolvedValue(LANGUAGES);
  mocks.saveProductDescription.mockResolvedValue({ version: 2 });
});
afterEach(() => cleanup());

describe('ProductEditPage: панель за збереженим станом, не за перемикачем', () => {
  it('клік по типу БЕЗ збереження не підмінює панель; збереження — підмінює', async () => {
    const user = userEvent.setup();
    render(<ProductEditPage productId={ID} />, { wrapper });
    await screen.findByLabelText('Товар з модифікаціями');
    expect(screen.queryByRole('button', { name: 'Додати' })).toBeNull();

    await user.click(screen.getByLabelText('Товар з модифікаціями'));
    expect(screen.queryByRole('button', { name: 'Додати' })).toBeNull();

    mocks.getProduct.mockResolvedValue(aggregate(true, 2));
    await user.click(screen.getAllByRole('button', { name: 'Зберегти' })[0]!);
    await screen.findByRole('button', { name: 'Додати' });
    expect(mocks.saveProductDescription).toHaveBeenCalledWith({
      data: {
        id: ID,
        expectedVersion: 1,
        base: { hasModifications: true, sku: null, stockStatus: 'in_stock' },
      },
    });
    await waitFor(() => expect(mocks.getProduct).toHaveBeenCalledTimes(2));
  });
});
