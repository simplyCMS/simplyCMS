// @vitest-environment jsdom
/**
 * Невалідна форма картки: submit із порожньою назвою основної мови — інлайн-
 * помилка під полем, тост `admin.products.fixFields`, onSubmit НЕ
 * викликано. Мутація: прибрати onInvalid із form.handleSubmit → тост не
 * показано → червоне.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from 'simplycms/i18n';
import { ResizeObserverStub } from './test-engine-stub';

vi.stubGlobal('ResizeObserver', ResizeObserverStub);
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock({}),
);
vi.mock('../../../../components/RichTextEditor', () => ({
  RichTextEditor: () => null,
}));
vi.mock('simplycms/core/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn() } }));

import { ProductForm } from '../ProductForm';
import { blankForm } from '../product-aggregate';
import {
  productFormSchemaFor,
  type ProductFormValues,
} from '../product-form-schema';

const LANGS = [{ code: 'uk', name: 'Українська', isDefault: true }];

function Harness({ onSubmit }: { onSubmit: () => void }) {
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchemaFor('uk')),
    defaultValues: blankForm(['uk']),
  });
  return (
    <ProductForm
      form={form}
      mode="create"
      translation={{
        languages: LANGS,
        primary: 'uk',
        statuses: {},
        active: 'uk',
        setActive: () => undefined,
      }}
      card={{
        productId: null,
        entityId: 'new-product-id',
        paths: {},
        persistedModificationIds: new Set(),
        modificationErrors: {},
        valueErrors: {},
        clearValueError: () => undefined,
        onConflict: () => undefined,
        onStockStatus: () => undefined,
        onPathSaved: () => undefined,
      }}
      onSubmit={onSubmit}
      submitLabel="Створити"
    />
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('ProductForm: невалідна назва — інлайн-помилка й тост', () => {
  it('submit із порожньою назвою: помилка під полем, тост, onSubmit НЕ викликано', async () => {
    const onSubmit = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <I18nProvider locale="uk">
          <Harness onSubmit={onSubmit} />
        </I18nProvider>
      </QueryClientProvider>,
    );

    // 🔴 jsdom не тригерить submit-подію з голого click по вкладеній
    // type=submit кнопці — submit форми напряму, як робить браузер.
    fireEvent.submit(
      screen.getByRole('button', { name: /Створити/ }).closest('form')!,
    );

    const error = await screen.findByRole('alert');
    expect(error.textContent).toBe('Введіть назву товару');
    expect(toastError).toHaveBeenCalledWith('Перевірте виділені поля');
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
