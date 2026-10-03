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
import { PROPS, echoInsert, serve, wrapper } from './render-support';

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const { toastError, toastSuccess, navigate } = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: { error: toastError, success: toastSuccess },
}));
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }));

const {
  listSectionProperties,
  insertSectionProperties,
  removeSectionProperties,
} = vi.hoisted(() => ({
  listSectionProperties: vi.fn(),
  insertSectionProperties: vi.fn(),
  removeSectionProperties: vi.fn(),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock({
    listSectionProperties,
    insertSectionProperties,
    removeSectionProperties,
  }),
);

import PropertiesPage from '../PropertiesPage';

const t = createTranslator('uk');

beforeEach(() => {
  vi.clearAllMocks();
  // Фікстури в зворотному порядку — сортування за назвою робить сторінка.
  listSectionProperties.mockImplementation(serve([...PROPS].reverse()));
  insertSectionProperties.mockImplementation(echoInsert);
});
afterEach(() => cleanup());

const openCreate = async () => {
  await screen.findByText('Бренд');
  fireEvent.click(
    screen.getByRole('button', { name: t('admin.properties.add') }),
  );
  return screen.findByRole('dialog');
};

describe('PropertiesPage', () => {
  it('повний зріз без where, відсортований за назвою', async () => {
    render(<PropertiesPage />, { wrapper });
    await screen.findByText('Бренд');
    const names = screen
      .getAllByRole('row')
      .slice(1)
      .map((r) => within(r).getAllByRole('cell')[0]!.textContent);
    expect(names).toEqual(['Бренд', 'Вага', 'Колір']);
    const [{ data }] = listSectionProperties.mock.calls[0] as [
      { data: { subset?: { filters?: unknown[] } } },
    ];
    expect(data.subset?.filters ?? []).toEqual([]);
  });

  it('створення: insert з crypto id, тип за замовчуванням text, sectionId null', async () => {
    render(<PropertiesPage />, { wrapper });
    const dialog = await openCreate();
    fireEvent.change(within(dialog).getByLabelText(t('common.name')), {
      target: { value: 'Матеріал' },
    });
    fireEvent.change(within(dialog).getByLabelText(t('admin.common.slug')), {
      target: { value: 'material' },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: t('common.create') }),
    );
    await waitFor(() => expect(insertSectionProperties).toHaveBeenCalled());
    const [{ data }] = insertSectionProperties.mock.calls[0] as [
      { data: Array<Record<string, unknown>> },
    ];
    expect(data[0]!.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(data[0]).toMatchObject({
      name: 'Матеріал',
      slug: 'material',
      propertyType: 'text',
      sectionId: null,
      sortOrder: 0,
    });
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(t('admin.properties.created')),
    );
  });

  it('кириличний slug → помилка біля поля, insert не викликано', async () => {
    render(<PropertiesPage />, { wrapper });
    const dialog = await openCreate();
    fireEvent.change(within(dialog).getByLabelText(t('common.name')), {
      target: { value: 'Матеріал' },
    });
    fireEvent.change(within(dialog).getByLabelText(t('admin.common.slug')), {
      target: { value: 'матеріал' },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: t('common.create') }),
    );
    await within(dialog).findByText(t('admin.properties.slugHint'), {
      selector: '[role="alert"]',
    });
    expect(insertSectionProperties).not.toHaveBeenCalled();
  });

  it('дубль slug → тост admin.errors.slugTaken, діалог лишається', async () => {
    insertSectionProperties.mockRejectedValue(
      Object.assign(new Error('dup'), {
        name: 'AdminConflictError',
        kind: 'unique',
        constraint: 'section_properties_slug_key',
      }),
    );
    render(<PropertiesPage />, { wrapper });
    const dialog = await openCreate();
    fireEvent.change(within(dialog).getByLabelText(t('common.name')), {
      target: { value: 'Бренд 2' },
    });
    fireEvent.change(within(dialog).getByLabelText(t('admin.common.slug')), {
      target: { value: 'brand' },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: t('common.create') }),
    );
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(t('admin.errors.slugTaken')),
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('видалення зі списку: AlertDialog з admin.properties.deleteWarning → remove(id)', async () => {
    removeSectionProperties.mockResolvedValue(undefined);
    render(<PropertiesPage />, { wrapper });
    const row = (await screen.findByText('Вага')).closest('tr')!;
    fireEvent.click(
      within(row).getByRole('button', { name: t('admin.properties.delete') }),
    );
    const dialog = await screen.findByRole('alertdialog');
    expect(
      within(dialog).getByText(t('admin.properties.deleteWarning')),
    ).toBeTruthy();
    fireEvent.click(
      within(dialog).getByRole('button', { name: t('common.delete') }),
    );
    await waitFor(() =>
      expect(removeSectionProperties).toHaveBeenCalledWith({
        data: [{ id: PROPS[1]!.id }],
      }),
    );
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(t('admin.properties.deleted')),
    );
  });
});
