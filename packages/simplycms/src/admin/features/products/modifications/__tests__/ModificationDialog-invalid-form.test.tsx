// @vitest-environment jsdom
/**
 * Невалідна форма модифікації (рев'ю): submit із невалідним slug —
 * інлайн-помилка під полем, тост `admin.products.fixFields`, onCreate НЕ
 * викликано. Мутація: прибрати onInvalid із form.handleSubmit → тост не
 * показано → червоне.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { I18nProvider } from 'simplycms/i18n';

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

vi.mock('simplycms/admin-server', () => ({
  listOrderStatuses: vi.fn(async () => []),
  insertOrderStatuses: vi.fn(),
  updateOrderStatuses: vi.fn(),
  removeOrderStatuses: vi.fn(),
  listProducts: vi.fn(async () => []),
  insertProducts: vi.fn(),
  updateProducts: vi.fn(),
  removeProducts: vi.fn(),
  listProductModifications: vi.fn(async () => []),
  insertProductModifications: vi.fn(),
  updateProductModifications: vi.fn(),
  removeProductModifications: vi.fn(),
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
const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn() } }));

import { ModificationDialog } from '../ModificationDialog';

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

describe('ModificationDialog: невалідний slug — інлайн-помилка й тост', () => {
  it('submit із невалідним slug: помилка під полем, тост, onCreate НЕ викликано', async () => {
    const onCreate = vi.fn();
    render(
      <ModificationDialog
        open
        onOpenChange={vi.fn()}
        productId="p1"
        sectionId={null}
        mod={null}
        onCreate={onCreate}
        onUpdate={vi.fn()}
      />,
      { wrapper },
    );

    fireEvent.change(screen.getByLabelText('Назва *'), {
      target: { value: 'Panel' },
    });
    fireEvent.change(screen.getByLabelText('URL (slug) *'), {
      target: { value: 'Panel-1' }, // невалідно: великі літери
    });
    fireEvent.click(screen.getByRole('button', { name: 'Створити' }));

    const error = await screen.findByRole('alert');
    expect(error.textContent).toBe(
      'Латиниця, цифри й дефіс — наприклад, wireless-mouse-100w',
    );
    expect(toastError).toHaveBeenCalledWith('Перевірте виділені поля');
    expect(onCreate).not.toHaveBeenCalled();
  });
});
