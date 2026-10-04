// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { createTranslator } from 'simplycms/i18n';
import type { SectionProperty } from 'simplycms/schema/types';
import { ID, OPTIONS, PROPS, serve, wrapper } from './render-support';

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const { toastError, toastSuccess, navigate, params } = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  navigate: vi.fn(),
  params: { propertyId: '' },
}));
vi.mock('sonner', () => ({
  toast: { error: toastError, success: toastSuccess },
}));
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
  useParams: () => params,
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

const {
  listSectionProperties,
  updateSectionProperties,
  removeSectionProperties,
  listPropertyOptions,
} = vi.hoisted(() => ({
  listSectionProperties: vi.fn(),
  updateSectionProperties: vi.fn(),
  removeSectionProperties: vi.fn(),
  listPropertyOptions: vi.fn(),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock({
    listSectionProperties,
    updateSectionProperties,
    removeSectionProperties,
    listPropertyOptions,
  }),
);

import PropertyEditPage from '../PropertyEditPage';

const t = createTranslator('uk');

let rows: SectionProperty[] = PROPS;

beforeEach(() => {
  vi.clearAllMocks();
  rows = PROPS;
  params.propertyId = ID.brand;
  listSectionProperties.mockImplementation((a) => serve(rows)(a));
  listPropertyOptions.mockImplementation(serve(OPTIONS));
  updateSectionProperties.mockImplementation(
    async ({ data }: { data: { id: string; patch: object }[] }) =>
      data.map(({ id, patch }) => ({
        ...rows.find((r) => r.id === id)!,
        ...patch,
      })),
  );
});
afterEach(() => cleanup());

describe('PropertyEditPage', () => {
  // Відсутність propertyType у самому patch доводить юніт `toPropertyPatch`
  // (property-form-schema.test.ts); тут — сторінкова проводка до serverFn.
  it('у режимі редагування немає контролу типу; save шле лише змінене поле (без propertyType — див. юніт toPropertyPatch)', async () => {
    render(<PropertyEditPage />, { wrapper });
    await screen.findByDisplayValue('Бренд');
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByText(t('admin.properties.type.select'))).toBeTruthy();
    expect(screen.getByText(t('admin.properties.typeImmutable'))).toBeTruthy();
    fireEvent.change(screen.getByLabelText(t('common.name')), {
      target: { value: 'Виробник' },
    });
    fireEvent.click(screen.getByRole('button', { name: t('common.save') }));
    await waitFor(() => expect(updateSectionProperties).toHaveBeenCalled());
    const [{ data }] = updateSectionProperties.mock.calls[0] as [
      { data: Array<{ id: string; patch: Record<string, unknown> }> },
    ];
    expect(data[0]!.id).toBe(ID.brand);
    expect(data[0]!.patch).not.toHaveProperty('propertyType');
    expect(data[0]!.patch).toEqual({ name: 'Виробник' });
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(t('admin.properties.saved')),
    );
  });

  it.each(['text', 'number', 'boolean'] as const)(
    'блок опцій відсутній для %s',
    async (propertyType) => {
      rows = PROPS.map((p) => (p.id === ID.brand ? { ...p, propertyType } : p));
      render(<PropertyEditPage />, { wrapper });
      await screen.findByDisplayValue('Бренд');
      expect(
        screen.queryByText(t('admin.properties.options.title')),
      ).toBeNull();
      expect(listPropertyOptions).not.toHaveBeenCalled();
    },
  );

  it('блок опцій є для select: лише опції цієї властивості', async () => {
    render(<PropertyEditPage />, { wrapper });
    await screen.findByText(t('admin.properties.options.title'));
    await screen.findByText('Samsung');
    expect(screen.getByText('Apple')).toBeTruthy();
  });

  it('діалог видалення містить admin.properties.deleteWarning', async () => {
    render(<PropertyEditPage />, { wrapper });
    await screen.findByDisplayValue('Бренд');
    fireEvent.click(
      screen.getByRole('button', { name: t('admin.properties.delete') }),
    );
    const dialog = await screen.findByRole('alertdialog');
    expect(
      within(dialog).getByText(t('admin.properties.deleteWarning')),
    ).toBeTruthy();
  });

  it('видалення: без проміжного «не знайдено»; відмова сервера → тост і рядок повертається', async () => {
    let reject!: (e: unknown) => void;
    removeSectionProperties.mockReturnValue(
      new Promise((_, rej) => {
        reject = rej;
      }),
    );
    render(<PropertyEditPage />, { wrapper });
    await screen.findByDisplayValue('Бренд');
    fireEvent.click(
      screen.getByRole('button', { name: t('admin.properties.delete') }),
    );
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(
      within(dialog).getByRole('button', { name: t('common.delete') }),
    );
    await waitFor(() => expect(removeSectionProperties).toHaveBeenCalled());
    // Оптимістично рядка вже немає, але сторінка НЕ показує «не знайдено».
    expect(screen.queryByText(t('admin.properties.notFound'))).toBeNull();
    reject(new Error('boom'));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(`${t('common.error')} boom`),
    );
    await screen.findByDisplayValue('Бренд');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('видалення успішне → тост і перехід на список', async () => {
    removeSectionProperties.mockResolvedValue(undefined);
    render(<PropertyEditPage />, { wrapper });
    await screen.findByDisplayValue('Бренд');
    fireEvent.click(
      screen.getByRole('button', { name: t('admin.properties.delete') }),
    );
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(
      within(dialog).getByRole('button', { name: t('common.delete') }),
    );
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(toastSuccess).toHaveBeenCalledWith(t('admin.properties.deleted'));
    expect(screen.queryByText(t('admin.properties.notFound'))).toBeNull();
  });

  it('дубль slug → тост admin.errors.slugTaken', async () => {
    updateSectionProperties.mockRejectedValue(
      Object.assign(new Error('dup'), {
        name: 'AdminConflictError',
        kind: 'unique',
        constraint: 'section_properties_slug_key',
      }),
    );
    render(<PropertyEditPage />, { wrapper });
    await screen.findByDisplayValue('Бренд');
    fireEvent.change(screen.getByLabelText(t('admin.common.slug')), {
      target: { value: 'weight' },
    });
    fireEvent.click(screen.getByRole('button', { name: t('common.save') }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(t('admin.errors.slugTaken')),
    );
  });

  it('кириличний slug → помилка біля поля, update не викликано', async () => {
    render(<PropertyEditPage />, { wrapper });
    await screen.findByDisplayValue('Бренд');
    fireEvent.change(screen.getByLabelText(t('admin.common.slug')), {
      target: { value: 'Бренд' },
    });
    fireEvent.click(screen.getByRole('button', { name: t('common.save') }));
    await screen.findByText(t('admin.properties.slugHint'), {
      selector: '[role="alert"]',
    });
    expect(updateSectionProperties).not.toHaveBeenCalled();
  });

  it('невідомий id: стан «не знайдено», форми немає', async () => {
    params.propertyId = 'c0000000-0000-4000-8000-0000000000ff';
    render(<PropertyEditPage />, { wrapper });
    await screen.findByText(t('admin.properties.notFound'));
    expect(screen.queryByLabelText(t('common.name'))).toBeNull();
  });

  it('відмова видалення: несохранене введення лишається після повернення рядка', async () => {
    let reject!: (e: unknown) => void;
    removeSectionProperties.mockReturnValue(
      new Promise((_, rej) => {
        reject = rej;
      }),
    );
    render(<PropertyEditPage />, { wrapper });
    await screen.findByDisplayValue('Бренд');
    fireEvent.change(screen.getByLabelText(t('common.name')), {
      target: { value: 'Бренд змінений' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: t('admin.properties.delete') }),
    );
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(
      within(dialog).getByRole('button', { name: t('common.delete') }),
    );
    await waitFor(() => expect(removeSectionProperties).toHaveBeenCalled());
    expect(screen.queryByText(t('admin.properties.notFound'))).toBeNull();
    reject(new Error('boom'));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(`${t('common.error')} boom`),
    );
    await screen.findByDisplayValue('Бренд змінений');
    expect(screen.queryByText(t('admin.properties.notFound'))).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });
});
