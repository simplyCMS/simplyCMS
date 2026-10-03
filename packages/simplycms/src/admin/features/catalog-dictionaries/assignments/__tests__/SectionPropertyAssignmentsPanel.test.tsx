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
import {
  ASSIGNMENTS,
  ID,
  PROPS,
  echoInsert,
  serve,
  wrapper,
} from '../../properties/__tests__/render-support';

const { toastError, toastSuccess } = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: { error: toastError, success: toastSuccess },
}));
// Radix Select у jsdom 30 не працює (немає hasPointerCapture/scrollIntoView,
// див. ProductsPage.test.tsx) — діалог замокано кнопками з тим самим
// контрактом props: що панель передала в `properties`, те й видно.
vi.mock('../AddAssignmentDialog', () => ({
  AddAssignmentDialog: (p: {
    open: boolean;
    appliesTo: 'product' | 'modification';
    properties: ReadonlyArray<{ id: string; name: string }>;
    onAdd: (propertyId: string) => void;
  }) =>
    p.open ? (
      <div data-testid="add-dialog" data-applies-to={p.appliesTo}>
        {p.properties.map((x) => (
          <button key={x.id} type="button" onClick={() => p.onAdd(x.id)}>
            pick:{x.name}
          </button>
        ))}
      </div>
    ) : null,
}));

const {
  listSectionProperties,
  listSectionPropertyAssignments,
  insertSectionPropertyAssignments,
  removeSectionPropertyAssignments,
} = vi.hoisted(() => ({
  listSectionProperties: vi.fn(),
  listSectionPropertyAssignments: vi.fn(),
  insertSectionPropertyAssignments: vi.fn(),
  removeSectionPropertyAssignments: vi.fn(),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock({
    listSectionProperties,
    listSectionPropertyAssignments,
    insertSectionPropertyAssignments,
    removeSectionPropertyAssignments,
  }),
);

import { SectionPropertyAssignmentsPanel } from '../SectionPropertyAssignmentsPanel';

const t = createTranslator('uk');

const region = (key: 'productProps' | 'modificationProps') =>
  screen.getByRole('region', { name: t(`admin.properties.section.${key}`) });

beforeEach(() => {
  vi.clearAllMocks();
  listSectionProperties.mockImplementation(serve(PROPS));
  listSectionPropertyAssignments.mockImplementation(serve(ASSIGNMENTS));
  insertSectionPropertyAssignments.mockImplementation(echoInsert);
});
afterEach(() => cleanup());

const ready = async () => {
  render(<SectionPropertyAssignmentsPanel sectionId={ID.section} />, {
    wrapper,
  });
  await within(
    await screen.findByRole('region', {
      name: t('admin.properties.section.productProps'),
    }),
  ).findByText('Бренд');
};

describe('SectionPropertyAssignmentsPanel', () => {
  it('дві таблиці; призначення ІНШОГО розділу не видно', async () => {
    await ready();
    expect(within(region('modificationProps')).queryByText('Вага')).toBeNull();
    expect(
      within(region('modificationProps')).getByText(
        t('admin.properties.empty'),
      ),
    ).toBeTruthy();
  });

  it('додавання: insert з crypto id, appliesTo режиму діалогу', async () => {
    await ready();
    fireEvent.click(
      within(region('modificationProps')).getByRole('button', {
        name: t('admin.properties.section.addForModification'),
      }),
    );
    const dialog = screen.getByTestId('add-dialog');
    expect(dialog.getAttribute('data-applies-to')).toBe('modification');
    // Review Focus 3: «Бренд» уже призначено для товарів — для модифікацій його немає.
    expect(within(dialog).queryByText('pick:Бренд')).toBeNull();
    fireEvent.click(within(dialog).getByText('pick:Колір'));
    await waitFor(() =>
      expect(insertSectionPropertyAssignments).toHaveBeenCalled(),
    );
    const [{ data }] = insertSectionPropertyAssignments.mock.calls[0] as [
      { data: Array<Record<string, unknown>> },
    ];
    expect(data[0]!.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(data[0]).toMatchObject({
      sectionId: ID.section,
      propertyId: ID.color,
      appliesTo: 'modification',
      sortOrder: 0,
    });
    await within(region('modificationProps')).findByText('Колір');
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(
        t('admin.properties.section.added'),
      ),
    );
  });

  it('додавання для товарів: sortOrder = довжина списку товарів', async () => {
    await ready();
    fireEvent.click(
      within(region('productProps')).getByRole('button', {
        name: t('admin.properties.section.addForProduct'),
      }),
    );
    fireEvent.click(screen.getByText('pick:Вага'));
    await waitFor(() =>
      expect(insertSectionPropertyAssignments).toHaveBeenCalled(),
    );
    const [{ data }] = insertSectionPropertyAssignments.mock.calls[0] as [
      { data: Array<Record<string, unknown>> },
    ];
    expect(data[0]).toMatchObject({ appliesTo: 'product', sortOrder: 1 });
  });

  it('сервер 409 unique → тост admin.errors.conflictUnique, рядок відкочено', async () => {
    let reject!: (e: unknown) => void;
    insertSectionPropertyAssignments.mockReturnValue(
      new Promise((_, rej) => {
        reject = rej;
      }),
    );
    await ready();
    fireEvent.click(
      within(region('modificationProps')).getByRole('button', {
        name: t('admin.properties.section.addForModification'),
      }),
    );
    fireEvent.click(screen.getByText('pick:Колір'));
    await within(region('modificationProps')).findByText('Колір');
    reject(
      Object.assign(new Error('dup'), {
        name: 'AdminConflictError',
        kind: 'unique',
        constraint: 'section_property_assignments_section_id_property_id_key',
      }),
    );
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(t('admin.errors.conflictUnique')),
    );
    await waitFor(() =>
      expect(
        within(region('modificationProps')).queryByText('Колір'),
      ).toBeNull(),
    );
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('видалення призначення: AlertDialog → remove(id)', async () => {
    removeSectionPropertyAssignments.mockResolvedValue(undefined);
    await ready();
    const row = within(region('productProps'))
      .getByText('Бренд')
      .closest('tr')!;
    fireEvent.click(
      within(row).getByRole('button', {
        name: t('admin.properties.section.remove'),
      }),
    );
    const dialog = await screen.findByRole('alertdialog');
    expect(
      within(dialog).getByText(t('admin.properties.section.removeWarning')),
    ).toBeTruthy();
    fireEvent.click(
      within(dialog).getByRole('button', { name: t('common.delete') }),
    );
    await waitFor(() =>
      expect(removeSectionPropertyAssignments).toHaveBeenCalledWith({
        data: [{ id: ID.assignBrand }],
      }),
    );
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(
        t('admin.properties.section.removed'),
      ),
    );
  });
});
