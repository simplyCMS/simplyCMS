// @vitest-environment jsdom
/**
 * `PricesEditor`/`usePrices` (архітектор, item 3): прямий виклик
 * `saveProductPrices` (поза колекцією — `usePrices.save` кличе serverFn
 * напряму, помилка йде вгору в `handleSave`'s `catch` НЕЗМІНЕНОЮ, без
 * `normalizeThrown` колекцій). Тут — конфлікт БЕЗ константи `*slug*`
 * (`idx_product_prices_unique`): `adminErrorKey` не має для неї власного
 * ключа й повертає ЗАГАЛЬНИЙ `admin.errors.conflictUnique` — тост несе
 * i18n-переклад, а не сирий SQL-текст `message`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { I18nProvider } from 'simplycms/i18n';

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn() } }));

const { saveProductPrices, listProductPrices, listPriceTypes } = vi.hoisted(
  () => ({
    saveProductPrices: vi.fn(async () => {
      throw Object.assign(
        new Error(
          'duplicate key value violates unique constraint "idx_product_prices_unique"',
        ),
        {
          name: 'AdminConflictError',
          kind: 'unique',
          constraint: 'idx_product_prices_unique',
        },
      );
    }),
    listProductPrices: vi.fn(async () => [] as unknown[]),
    listPriceTypes: vi.fn(async () => [] as unknown[]),
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
  listProductModifications: vi.fn(async () => []),
  insertProductModifications: vi.fn(),
  updateProductModifications: vi.fn(),
  removeProductModifications: vi.fn(),
  setDefaultProductModification: vi.fn(),
  reorderProductModification: vi.fn(),
  listProductPrices,
  saveProductPrices,
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
  listPriceTypes,
  listSectionPropertyAssignments: vi.fn(async () => []),
  listSectionProperties: vi.fn(async () => []),
  listPropertyOptions: vi.fn(async () => []),
}));

import { PricesEditor } from '../PricesEditor';

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale="uk">{children}</I18nProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('PricesEditor', () => {
  it('конфлікт без "slug" у constraint — загальний i18n-ключ, не сирий message', async () => {
    render(<PricesEditor productId="p1" modificationId={null} />, {
      wrapper,
    });

    screen.getByRole('button', { name: 'Зберегти ціни' }).click();

    await waitFor(() => expect(saveProductPrices).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('Таке значення вже існує'),
    );
  });
});
