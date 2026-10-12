// @vitest-environment jsdom
// К3-Е6д-1: форми каталогу з фабричною опцією `media` не стирають файл при
// прибиранні картинки з форми — це робить сервер після успішного запису
// (скасована форма не мусить лишити рядок із посиланням на стертий файл).
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { FormProvider, useForm, type FieldValues } from 'react-hook-form';
import { I18nProvider } from 'simplycms/i18n';

const mocks = vi.hoisted(() => ({
  uploadMedia: vi.fn(),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock(mocks),
);
vi.mock('simplycms/core/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
// Tiptap у jsdom не потрібен: перевіряється лише блок зображення.
vi.mock('../../components/RichTextEditor', () => ({
  RichTextEditor: () => null,
}));

import { SectionSideCards } from '../catalog-dictionaries/sections/SectionSideCards';
import { OptionPageCards } from '../catalog-dictionaries/properties/OptionPageCards';
import { ProductMainFields } from '../products/edit/ProductMainFields';
import { ModificationFormFields } from '../products/modifications/ModificationFormFields';

afterEach(() => cleanup());

const REF = 'product/a.png';
type Render = (form: never) => ReactNode;

/** Форма з одним референсом у `images`; повертає значення `images` після кліку «×». */
function removeImage(body: Render) {
  const seen: { images?: unknown } = {};
  function Harness() {
    const form = useForm<FieldValues>({
      defaultValues: {
        images: [REF],
        name: '',
        slug: '',
        description: '',
        metaTitle: '',
        metaDescription: '',
      },
    });
    seen.images = form.watch('images');
    return (
      <I18nProvider locale="uk">
        <FormProvider {...form}>{body(form as never)}</FormProvider>
      </I18nProvider>
    );
  }
  const { container } = render(<Harness />);
  fireEvent.click(container.querySelector('.lucide-x')!.closest('button')!);
  return seen;
}

describe('форми каталогу: прибрана картинка не стирає файл (К3-Е6д-1)', () => {
  const cases: [string, Render][] = [
    [
      'розділ',
      (form) => <SectionSideCards form={form} entityId="section-id" />,
    ],
    [
      'опція властивості',
      (form) => <OptionPageCards form={form} entityId="option-id" />,
    ],
    ['товар', () => <ProductMainFields entityId="product-id" />],
    ['модифікація', () => <ModificationFormFields modId="mod-id" />],
  ];
  it.each(cases)('%s: референс знято з форми', async (_n, body) => {
    const seen = removeImage(body);
    await Promise.resolve();
    expect(seen.images).toEqual([]);
  });
});
