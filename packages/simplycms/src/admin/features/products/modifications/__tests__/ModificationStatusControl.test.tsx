// @vitest-environment jsdom
/**
 * `ModificationStatusControl` (рев'ю C6, item 2): миттєвий `mods.update`
 * над живим рядком (edit-гілка) без `.catch` на `tx.isPersisted.promise` —
 * відхилена мутація тихо відкочувалась (бібліотека сама робить rollback) і
 * лишала unhandled rejection у консолі, нічого не звітуючи користувачу.
 *
 * `StockStatusSelect` замокано кнопкою — реальний Radix Select у jsdom 30
 * не має `hasPointerCapture`/`scrollIntoView` (той самий клас проблем, що
 * в `ProductsPage.test.tsx`); тут перевіряється `.catch`-проводка
 * (`reportTxError`), не UI взаємодія з Select.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import type { ReactNode } from 'react';
import { I18nProvider } from 'simplycms/i18n';
import type { ProductModification } from 'simplycms/schema/types';

vi.mock('../../stock/StockStatusSelect', () => ({
  StockStatusSelect: ({ onChange }: { onChange: (v: string) => void }) => (
    <button onClick={() => onChange('out_of_stock')}>change-status</button>
  ),
}));

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn() } }));

const { listProductModifications, updateProductModifications } = vi.hoisted(
  () => ({
    listProductModifications: vi.fn(async () => [
      {
        id: 'm1',
        productId: 'p1',
        slug: 'a',
        name: 'A',
        sku: null,
        isDefault: false,
        images: [],
        sortOrder: 0,
        stockStatus: 'in_stock',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]),
    updateProductModifications: vi.fn(async () => {
      throw Object.assign(new Error('conflict'), {
        name: 'AdminConflictError',
        kind: 'unique',
        constraint: 'x_key',
      });
    }),
  }),
);
vi.mock('simplycms/admin-server', () => ({
  listOrderStatuses: vi.fn(async () => []),
  insertOrderStatuses: vi.fn(),
  updateOrderStatuses: vi.fn(),
  removeOrderStatuses: vi.fn(),
  setDefaultOrderStatus: vi.fn(),
  reorderOrderStatus: vi.fn(),
  listProducts: vi.fn(async () => []),
  insertProducts: vi.fn(),
  updateProducts: vi.fn(),
  removeProducts: vi.fn(),
  listProductModifications,
  insertProductModifications: vi.fn(),
  updateProductModifications,
  removeProductModifications: vi.fn(),
  setDefaultProductModification: vi.fn(),
  reorderProductModification: vi.fn(),
  listProductPrices: vi.fn(async () => []),
  saveProductPrices: vi.fn(),
  listStock: vi.fn(async () => []),
  saveStock: vi.fn(),
  listProductPropertyValues: vi.fn(async () => []),
  insertProductPropertyValues: vi.fn(),
  updateProductPropertyValues: vi.fn(),
  removeProductPropertyValues: vi.fn(),
  listModificationPropertyValues: vi.fn(async () => []),
  insertModificationPropertyValues: vi.fn(),
  updateModificationPropertyValues: vi.fn(),
  removeModificationPropertyValues: vi.fn(),
  listSections: vi.fn(async () => []),
  listPriceTypes: vi.fn(async () => []),
  listSectionPropertyAssignments: vi.fn(async () => []),
  listSectionProperties: vi.fn(async () => []),
  listPropertyOptions: vi.fn(async () => []),
}));

import { ModificationStatusControl } from '../ModificationStatusControl';
import { EMPTY_MODIFICATION_FORM } from '../modification-form-values';
import type { ModificationFormValues } from '../modification-form-schema';

const MOD: ProductModification = {
  id: 'm1',
  productId: 'p1',
  slug: 'a',
  name: 'A',
  sku: null,
  images: [],
  sortOrder: 0,
  stockStatus: 'in_stock',
  isDefault: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function Harness() {
  const form = useForm<ModificationFormValues>({
    defaultValues: EMPTY_MODIFICATION_FORM,
  });
  return <ModificationStatusControl mod={MOD} form={form} />;
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

describe('ModificationStatusControl: .catch на tx.isPersisted.promise', () => {
  it('відхилена мутація — тост з i18n-ключем, не мовчазний rollback', async () => {
    renderHarness();
    const button = await screen.findByRole('button', { name: 'change-status' });
    button.click();

    await waitFor(() =>
      expect(updateProductModifications).toHaveBeenCalledTimes(1),
    );
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('Таке значення вже існує'),
    );
  });
});
