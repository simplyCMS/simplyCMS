// @vitest-environment jsdom
/**
 * Рев'ю хвилі C (BLOCKER, структурний фікс): панелі-сателіти
 * (`SimpleProductPanel`) — СИБЛІНГИ `ProductForm.tsx`, не нащадки її
 * `<form>`. Негативний контроль (DOM-структура) — той самий прийом, що й
 * `ModificationDialog.test.tsx`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { I18nProvider } from 'simplycms/i18n';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

const { listProducts, listPriceTypes } = vi.hoisted(() => ({
  listProducts: vi.fn(async () => [] as unknown[]),
  listPriceTypes: vi.fn(async () => [] as unknown[]),
}));
vi.mock('simplycms/admin-server', () => ({
  listOrderStatuses: vi.fn(async () => []),
  insertOrderStatuses: vi.fn(),
  updateOrderStatuses: vi.fn(),
  removeOrderStatuses: vi.fn(),
  listProducts,
  insertProducts: vi.fn(),
  updateProducts: vi.fn(),
  removeProducts: vi.fn(),
  listProductModifications: vi.fn(async () => []),
  insertProductModifications: vi.fn(),
  updateProductModifications: vi.fn(),
  removeProductModifications: vi.fn(),
  listProductPrices: vi.fn(async () => []),
  saveProductPrices: vi.fn(async () => ({ rows: [], removedIds: [] })),
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
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }));

import { ProductEditPage } from '../ProductEditPage';

const PRODUCT_ID = '11111111-1111-4111-8111-111111111111';

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

describe('ProductEditPage: панелі — сиблінги форми, не нащадки', () => {
  it('кнопка «Зберегти ціни» (SimpleProductPanel) — НЕ нащадок <form> картки', async () => {
    listProducts.mockResolvedValueOnce([
      {
        id: PRODUCT_ID,
        name: 'Панель',
        slug: 'panel',
        shortDescription: null,
        description: null,
        metaTitle: null,
        metaDescription: null,
        sectionId: null,
        isActive: true,
        isFeatured: false,
        hasModifications: false,
        sku: 'SKU-1',
        stockStatus: 'in_stock',
        images: [],
        returnPolicy: null,
        shippingDetails: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const { container } = render(<ProductEditPage productId={PRODUCT_ID} />, {
      wrapper,
    });

    const saveButton = await waitFor(() =>
      screen.getByRole('button', { name: 'Зберегти ціни' }),
    );
    const cardForm = container.querySelector('form');
    expect(cardForm).not.toBeNull();
    expect(saveButton.closest('form')).not.toBe(cardForm);
  });
});
