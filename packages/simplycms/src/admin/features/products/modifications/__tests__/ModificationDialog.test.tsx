// @vitest-environment jsdom
/**
 * Рев'ю хвилі C (BLOCKER, структурний фікс): `<form>` діалогу несе ЛИШЕ
 * поля модифікації — Collapsible-и цін/залишків ПОЗА нею.
 *
 * 🔴 Негативний контроль — ПЕРШИЙ тест (DOM-структура): на стеші коду ДО
 * фіксу (PricesEditor — нащадок `<form onSubmit={submit}>`) він червоніє
 * (`saveButton.closest('form') === dialogForm`). Другий тест (клік не
 * кличе `onUpdate`) НЕ дискримінує — jsdom 30 не тригерить нативний
 * `submit` із голого `.click()` по вкладеній `type=submit` кнопці навіть
 * у старій структурі, тож він зелений і до, і після фіксу; лишається як
 * санітарна перевірка проводки (`saveProductPrices` дійсно викликається),
 * не як регрес-гейт.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { I18nProvider } from 'simplycms/i18n';
import type { ProductModification } from 'simplycms/schema/types';

// 🔴 jsdom 30 не має ResizeObserver — Radix Select (StockStatusSelect)
// вимірює тригер під час монтування (той самий клас проблем, що й
// hasPointerCapture/scrollIntoView, задокументований у ProductsPage.test.tsx).
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

const { saveProductPrices, listProductPrices, listPriceTypes } = vi.hoisted(
  () => ({
    saveProductPrices: vi.fn(async () => ({ rows: [], removedIds: [] })),
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

import { ModificationDialog } from '../ModificationDialog';
import type { ModificationFormValues } from '../modification-form-schema';

const MOD: ProductModification = {
  id: 'm1',
  productId: 'p1',
  slug: '100w',
  name: 'Модифікація 100w',
  sku: 'SKU-1',
  images: [],
  sortOrder: 0,
  stockStatus: 'in_stock',
  isDefault: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function renderDialog(
  onCreate: (values: ModificationFormValues) => Promise<string>,
  onUpdate: (id: string, values: ModificationFormValues) => Promise<void>,
) {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale="uk">{children}</I18nProvider>
    </QueryClientProvider>
  );
  return render(
    <ModificationDialog
      open
      onOpenChange={vi.fn()}
      productId="p1"
      sectionId={null}
      mod={MOD}
      onCreate={onCreate}
      onUpdate={onUpdate}
    />,
    { wrapper },
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('ModificationDialog: структурна ізоляція секцій від <form>', () => {
  it('кнопка «Зберегти ціни» — НЕ нащадок <form> діалогу', () => {
    // 🔴 Radix Dialog портализує вміст у document.body — не в container.
    renderDialog(vi.fn(), vi.fn());
    const saveButton = screen.getByRole('button', { name: 'Зберегти ціни' });
    const dialogForm = document.body.querySelector('form');
    expect(dialogForm).not.toBeNull();
    expect(saveButton.closest('form')).not.toBe(dialogForm);
  });

  it('клік «Зберегти ціни» кличе saveProductPrices (санітарна перевірка проводки)', async () => {
    const onCreate = vi.fn();
    const onUpdate = vi.fn();
    renderDialog(onCreate, onUpdate);

    screen.getByRole('button', { name: 'Зберегти ціни' }).click();
    await vi.waitFor(() => expect(saveProductPrices).toHaveBeenCalledTimes(1));

    expect(onUpdate).not.toHaveBeenCalled();
    expect(onCreate).not.toHaveBeenCalled();
  });
});
