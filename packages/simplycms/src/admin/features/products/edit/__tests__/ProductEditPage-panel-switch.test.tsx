// @vitest-environment jsdom
/**
 * Task 7 Step 3 (рев'ю): панель-сателіт перемикається за ЗБЕРЕЖЕНИМ рядком
 * колекції (`data.hasModifications`), не за `useWatch` незбереженого стану
 * форми. Клік по перемикачу типу БЕЗ Save панель не підмінює — лише
 * write-back (те, що робить реальний Save) підмінює.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { I18nProvider } from 'simplycms/i18n';
import { productsCollection, useCollection } from 'simplycms/admin-data';
import { EngineProvider } from 'simplycms/react-query';
import { ENGINE, ResizeObserverStub } from './test-engine-stub';

vi.stubGlobal('ResizeObserver', ResizeObserverStub);

const { listProducts, updateProducts, noop, noopList } = vi.hoisted(() => ({
  listProducts: vi.fn(async () => [] as unknown[]),
  // 🔴 Голий vi.fn() (undefined) валить `for (const row of rows)`
  // персист-хендлера й ВІДКОЧУЄ оптимізм (спіймано: write-back не долітав).
  updateProducts: vi.fn(
    async ({ data }: { data: Array<{ id: string; patch: object }> }) =>
      data.map((d) => ({ id: d.id, ...d.patch })),
  ),
  noop: () => vi.fn(),
  noopList: () => vi.fn(async () => [] as unknown[]),
}));
vi.mock('simplycms/admin-server', () => {
  return {
    listOrderStatuses: noopList(),
    insertOrderStatuses: noop(),
    updateOrderStatuses: noop(),
    removeOrderStatuses: noop(),
    listProducts,
    insertProducts: noop(),
    updateProducts,
    removeProducts: noop(),
    listProductModifications: noopList(),
    insertProductModifications: noop(),
    updateProductModifications: noop(),
    removeProductModifications: noop(),
    listProductPrices: noopList(),
    saveProductPrices: noop(),
    listStock: noopList(),
    saveStock: noop(),
    listProductPropertyValues: noopList(),
    insertProductPropertyValues: noop(),
    updateProductPropertyValues: noop(),
    removeProductPropertyValues: noop(),
    listModificationPropertyValues: noopList(),
    insertModificationPropertyValues: noop(),
    updateModificationPropertyValues: noop(),
    removeModificationPropertyValues: noop(),
    listSections: noopList(),
    listPriceTypes: noopList(),
    listSectionPropertyAssignments: noopList(),
    listSectionProperties: noopList(),
    listPropertyOptions: noopList(),
  };
});
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }));

import { ProductEditPage } from '../ProductEditPage';

const PRODUCT_ID = '22222222-2222-4222-8222-222222222222';

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <EngineProvider value={ENGINE}>
        <I18nProvider locale="uk">{children}</I18nProvider>
      </EngineProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('ProductEditPage: панель за живим рядком, не за useWatch', () => {
  it('клік по перемикачу типу БЕЗ Save не підмінює панель; write-back — підмінює', async () => {
    const now = new Date();
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
        createdAt: now,
        updatedAt: now,
      },
    ]);

    let writeBack: ((v: boolean) => void) | undefined;
    function WriteBackProbe() {
      // БЕЗ власного useLiveQuery — інший демо-ключ дав би ще один виклик
      // listProducts, а mockResolvedValueOnce уже не має рядка. Рядок кладе
      // findOne самої ProductEditPage; тут лише беремо той самий інстанс
      // колекції (WeakMap за queryClient), щоб писати в нього.
      const products = useCollection(productsCollection);
      writeBack = (v: boolean) =>
        products.update(PRODUCT_ID, (d) => {
          d.hasModifications = v;
        });
      return null;
    }

    render(
      <>
        <WriteBackProbe />
        <ProductEditPage productId={PRODUCT_ID} />
      </>,
      { wrapper },
    );

    // Товар простий — панель SimpleProductPanel («Додати» модифікацій нема).
    await screen.findByText('Товар з модифікаціями');
    expect(screen.queryByRole('button', { name: 'Додати' })).toBeNull();

    // Клік по радіо «з модифікаціями» — форма dirty, БЕЗ Save.
    screen.getByLabelText('Товар з модифікаціями').click();
    await Promise.resolve();
    expect(screen.queryByRole('button', { name: 'Додати' })).toBeNull();

    // Write-back (те, що робить РЕАЛЬНИЙ Save) — ось тепер панель підмінюється.
    await act(async () => {
      writeBack?.(true);
      await new Promise((r) => setTimeout(r, 0));
    });
    // findByRole сам кидає, якщо не знайдено — присутність кнопки доведена.
    await screen.findByRole('button', { name: 'Додати' });
  });
});
