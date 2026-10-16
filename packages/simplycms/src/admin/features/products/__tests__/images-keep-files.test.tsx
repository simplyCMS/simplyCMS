// @vitest-environment jsdom
// К3-Е6д-1 для картки товару й діалогу модифікації: прибрана з форми картинка
// не стирає файл у браузері — це робить сервер після успішного збереження.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { ResizeObserverStub } from '../edit/__tests__/test-engine-stub';
import { CardHarness, PRODUCT_ID } from './card-harness';

vi.stubGlobal('ResizeObserver', ResizeObserverStub);
const mocks = vi.hoisted(() => ({ uploadMedia: vi.fn() }));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock(mocks),
);
vi.mock('simplycms/core/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock('../../../components/RichTextEditor', () => ({
  RichTextEditor: () => null,
}));

import { ProductMainFields } from '../edit/ProductMainFields';
import type { ProductFormValues } from '../edit/product-form-schema';
import { ModificationFormFields } from '../modifications/ModificationFormFields';

afterEach(() => cleanup());
const click = (container: HTMLElement) =>
  fireEvent.click(container.querySelector('.lucide-x')!.closest('button')!);

describe('картка товару: прибране фото не стирає файл', () => {
  it('товар: фото знято з чернетки', () => {
    let form!: ReturnType<typeof useForm<ProductFormValues>>;
    const { container } = render(
      <CardHarness
        values={{
          images: [
            {
              id: PRODUCT_ID,
              storageKey: 'product/a.png',
              sortOrder: 0,
              alt: {},
              overrides: {},
            },
          ],
        }}
        onForm={(f) => (form = f)}
      >
        <ProductMainFields mode="edit" />
      </CardHarness>,
    );
    click(container);
    expect(form.getValues('images')).toEqual([]);
  });

  it('модифікація: ключ знято зі списку форми діалогу', () => {
    let images: unknown;
    function Inner() {
      const f = useForm({
        defaultValues: {
          names: {},
          tokens: {},
          sku: '',
          isDefault: false,
          images: ['product/a.png'],
        },
      });
      images = f.watch('images');
      return (
        <FormProvider {...f}>
          <ModificationFormFields productId={PRODUCT_ID} modId="m" />
        </FormProvider>
      );
    }
    const { container } = render(
      <CardHarness>
        <Inner />
      </CardHarness>,
    );
    click(container);
    expect(images).toEqual([]);
  });
});
