// @vitest-environment jsdom
/**
 * Невалідна форма картки (рев'ю): submit із порожньою назвою — інлайн-
 * помилка під полем, тост `admin.products.fixFields`, onSubmit НЕ
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
  listSections: vi.fn(async () => []),
}));
const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn() } }));

import { ProductForm } from '../ProductForm';
import type { ProductFormValues } from '../product-form-schema';

const DEFAULT_VALUES: ProductFormValues = {
  name: '',
  slug: 'panel',
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
};

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

describe('ProductForm: невалідна назва — інлайн-помилка й тост', () => {
  it('submit із порожньою назвою: помилка під полем, тост, onSubmit НЕ викликано', async () => {
    const onSubmit = vi.fn();
    render(
      <ProductForm
        productId={null}
        defaultValues={DEFAULT_VALUES}
        onSubmit={onSubmit}
        submitLabel="Створити"
      />,
      { wrapper },
    );

    // 🔴 jsdom не тригерить submit-подію форми з голого fireEvent.click по
    // ВКЛАДЕНІЙ type=submit кнопці (той самий клас, що й ResizeObserver/
    // hasPointerCapture-прогалини) — submit форми напряму, як реальний
    // браузер робить це за кліком.
    const btn = screen.getByRole('button', { name: /Створити/ });
    fireEvent.submit(btn.closest('form')!);

    const error = await screen.findByRole('alert');
    expect(error.textContent).toBe('Введіть назву товару');
    expect(toastError).toHaveBeenCalledWith('Перевірте виділені поля');
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
