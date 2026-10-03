// @vitest-environment jsdom
/**
 * `SimpleProductPanel` (рев'ю C6, item 2): миттєвий `products.update` над
 * живим рядком (`StockStatusSelect`) — без `.catch` на
 * `tx.isPersisted.promise` відхилена мутація тихо відкочувалась
 * (бібліотека сама робить rollback) і лишала unhandled rejection у
 * консолі. Той самий хелпер (`reportTxError`), що й
 * `ModificationStatusControl.test.tsx` — сюди перенесено лише проводку.
 *
 * `StockStatusSelect` замокано кнопкою — реальний Radix Select у jsdom 30
 * не має `hasPointerCapture`/`scrollIntoView` (`ProductsPage.test.tsx`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import type { ReactNode } from 'react';
import { I18nProvider } from 'simplycms/i18n';
import { Form } from 'simplycms/ui/form';

vi.mock('../../stock/StockStatusSelect', () => ({
  StockStatusSelect: ({ onChange }: { onChange: (v: string) => void }) => (
    <button onClick={() => onChange('out_of_stock')}>change-status</button>
  ),
}));

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn() } }));

const { listProducts, updateProducts } = vi.hoisted(() => ({
  listProducts: vi.fn(async () => [{ id: 'p1', stockStatus: 'in_stock' }]),
  updateProducts: vi.fn(async () => {
    throw Object.assign(new Error('conflict'), {
      name: 'AdminConflictError',
      kind: 'unique',
      constraint: 'x_key',
    });
  }),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock({
    listProducts,
    updateProducts,
  }),
);

import { SimpleProductPanel } from '../SimpleProductPanel';
import type { ProductFormValues } from '../../edit/product-form-schema';

function Harness() {
  const form = useForm<ProductFormValues>({
    defaultValues: {
      name: '',
      slug: '',
      shortDescription: '',
      description: '',
      metaTitle: '',
      metaDescription: '',
      sectionId: '',
      isActive: true,
      isFeatured: false,
      hasModifications: false,
      sku: '',
      stockStatus: 'in_stock',
      images: [],
    },
  });
  return (
    <Form {...form}>
      <SimpleProductPanel productId="p1" />
    </Form>
  );
}

function renderHarness() {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale="uk">{children}</I18nProvider>
    </QueryClientProvider>
  );
  return render(<Harness />, { wrapper });
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('SimpleProductPanel: .catch на tx.isPersisted.promise', () => {
  it('відхилена мутація — тост з i18n-ключем, не мовчазний rollback', async () => {
    renderHarness();
    const button = await screen.findByRole('button', { name: 'change-status' });
    button.click();

    await waitFor(() => expect(updateProducts).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('Таке значення вже існує'),
    );
  });
});
