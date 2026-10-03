// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { createTranslator } from 'simplycms/i18n';
import {
  ID,
  OPTIONS,
  PROPS,
  echoInsert,
  serve,
  wrapper,
} from './render-support';

const { toastError, toastSuccess, navigate, params } = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  navigate: vi.fn(),
  params: { propertyId: '', optionId: 'new' },
}));
vi.mock('sonner', () => ({
  toast: { error: toastError, success: toastSuccess },
}));
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
  useParams: () => params,
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
// Tiptap і справжнє завантаження файлів — поза юнітом: заглушки з тим самим контрактом props.
vi.mock('../../../../components/RichTextEditor', () => ({
  RichTextEditor: () => <div data-testid="rte" />,
}));
vi.mock('../../../../components/ImageUpload', () => ({
  ImageUpload: (p: {
    images: string[];
    onImagesChange: (i: string[]) => void;
    entityType: string;
    entityId?: string | null;
    maxImages?: number;
  }) => (
    <div
      data-testid="image-upload"
      data-entity-type={p.entityType}
      data-entity-id={p.entityId ?? ''}
      data-max={p.maxImages}
    >
      <button
        type="button"
        onClick={() => p.onImagesChange(['property_option/n/new.png'])}
      >
        add-image
      </button>
    </div>
  ),
}));

const {
  listSectionProperties,
  listPropertyOptions,
  insertPropertyOptions,
  updatePropertyOptions,
} = vi.hoisted(() => ({
  listSectionProperties: vi.fn(),
  listPropertyOptions: vi.fn(),
  insertPropertyOptions: vi.fn(),
  updatePropertyOptions: vi.fn(),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock({
    listSectionProperties,
    listPropertyOptions,
    insertPropertyOptions,
    updatePropertyOptions,
  }),
);

import PropertyOptionEditPage from '../PropertyOptionEditPage';

const t = createTranslator('uk');

const fill = (name: string, slug: string) => {
  fireEvent.change(screen.getByLabelText(t('common.name')), {
    target: { value: name },
  });
  fireEvent.change(screen.getByLabelText(t('admin.common.slug')), {
    target: { value: slug },
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  params.propertyId = ID.brand;
  params.optionId = 'new';
  listSectionProperties.mockImplementation(serve(PROPS));
  listPropertyOptions.mockImplementation(serve(OPTIONS));
  insertPropertyOptions.mockImplementation(echoInsert);
  updatePropertyOptions.mockImplementation(
    async ({ data }: { data: { id: string; patch: object }[] }) =>
      data.map(({ id, patch }) => ({
        ...OPTIONS.find((o) => o.id === id)!,
        ...patch,
      })),
  );
});
afterEach(() => cleanup());

describe('PropertyOptionEditPage', () => {
  it('нова опція: insert з propertyId з роута і sortOrder = кількість опцій', async () => {
    render(<PropertyOptionEditPage />, { wrapper });
    // Кількість опцій — з колекції (2 фікстури цієї властивості).
    await screen.findByDisplayValue('2');
    const up = screen.getByTestId('image-upload');
    expect(up.getAttribute('data-entity-type')).toBe('property_option');
    expect(up.getAttribute('data-max')).toBe('1');
    const newId = up.getAttribute('data-entity-id');
    expect(newId).toMatch(/^[0-9a-f-]{36}$/);
    fill('Xiaomi', 'xiaomi');
    fireEvent.click(screen.getByText('add-image'));
    fireEvent.click(screen.getByRole('button', { name: t('common.create') }));
    await waitFor(() => expect(insertPropertyOptions).toHaveBeenCalled());
    const [{ data }] = insertPropertyOptions.mock.calls[0] as [
      { data: Array<Record<string, unknown>> },
    ];
    expect(data[0]).toMatchObject({
      id: newId,
      propertyId: ID.brand,
      sortOrder: 2,
      slug: 'xiaomi',
      imageUrl: 'property_option/n/new.png',
      description: null,
    });
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(
        t('admin.properties.options.created'),
      ),
    );
    expect(navigate).toHaveBeenCalled();
  });

  it('кириличний slug → помилка біля поля, insert не викликано', async () => {
    render(<PropertyOptionEditPage />, { wrapper });
    await screen.findByDisplayValue('2');
    fill('Самсунг', 'самсунг');
    fireEvent.click(screen.getByRole('button', { name: t('common.create') }));
    await screen.findByText(t('admin.properties.options.slugHint'), {
      selector: '[role="alert"]',
    });
    expect(insertPropertyOptions).not.toHaveBeenCalled();
  });

  it('редагування: patch лише змінених полів, без propertyId', async () => {
    params.optionId = ID.samsung;
    render(<PropertyOptionEditPage />, { wrapper });
    await screen.findByDisplayValue('Samsung');
    expect(
      screen.getByTestId('image-upload').getAttribute('data-entity-id'),
    ).toBe(ID.samsung);
    fireEvent.change(screen.getByLabelText(t('common.name')), {
      target: { value: 'Samsung Electronics' },
    });
    fireEvent.click(screen.getByRole('button', { name: t('common.save') }));
    await waitFor(() => expect(updatePropertyOptions).toHaveBeenCalled());
    const [{ data }] = updatePropertyOptions.mock.calls[0] as [
      { data: Array<{ id: string; patch: Record<string, unknown> }> },
    ];
    expect(data[0]).toEqual({
      id: ID.samsung,
      patch: { name: 'Samsung Electronics' },
    });
  });

  it('дубль slug у властивості → тост admin.errors.slugTaken', async () => {
    insertPropertyOptions.mockRejectedValue(
      Object.assign(new Error('dup'), {
        name: 'AdminConflictError',
        kind: 'unique',
        constraint: 'property_options_property_id_slug_key',
      }),
    );
    render(<PropertyOptionEditPage />, { wrapper });
    await screen.findByDisplayValue('2');
    fill('Samsung 2', 'samsung');
    fireEvent.click(screen.getByRole('button', { name: t('common.create') }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(t('admin.errors.slugTaken')),
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it('невідомий id опції: стан «не знайдено», форми й insert немає', async () => {
    params.optionId = 'd0000000-0000-4000-8000-0000000000ff';
    render(<PropertyOptionEditPage />, { wrapper });
    await screen.findByText(t('admin.properties.options.notFound'));
    expect(screen.queryByLabelText(t('common.name'))).toBeNull();
    expect(insertPropertyOptions).not.toHaveBeenCalled();
  });
});
