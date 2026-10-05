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
import { resolveMediaUrl } from 'simplycms/domain/media';
import { createMutableServer } from '../../../../../admin-data/__tests__/support/mutable-server';
import { ID, OPTIONS, wrapper } from './render-support';

const { toastError, toastSuccess, navigate } = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: { error: toastError, success: toastSuccess },
}));
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }));

const { listPropertyOptions, removePropertyOptions } = vi.hoisted(() => ({
  listPropertyOptions: vi.fn(),
  removePropertyOptions: vi.fn(),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock({ listPropertyOptions, removePropertyOptions }),
);

import { PropertyOptionsTable } from '../PropertyOptionsTable';

const t = createTranslator('uk');

// Сервер зі станом (TSDB-1): після запису зріз ревалідується, і статична
// відповідь повернула б видалену опцію.
let srv = createMutableServer<(typeof OPTIONS)[number]>([]);
beforeEach(() => {
  vi.clearAllMocks();
  srv = createMutableServer([
    ...OPTIONS,
    // Опція ІНШОЇ властивості — зріз `where propertyId` мусить її відсіяти.
    {
      ...OPTIONS[1]!,
      id: crypto.randomUUID(),
      propertyId: ID.color,
      name: 'Червоний',
      slug: 'red',
    },
  ]);
  listPropertyOptions.mockImplementation(srv.list);
});
afterEach(() => cleanup());

const openDelete = async (name: string) => {
  const row = (await screen.findByText(name)).closest('tr')!;
  fireEvent.click(
    within(row).getByRole('button', {
      name: t('admin.properties.options.delete'),
    }),
  );
  return screen.findByRole('alertdialog');
};

describe('PropertyOptionsTable', () => {
  it('показує лише опції своєї властивості, мініатюра — через resolveMediaUrl', async () => {
    render(<PropertyOptionsTable propertyId={ID.brand} />, { wrapper });
    await screen.findByText('Samsung');
    expect(screen.getByText('Apple')).toBeTruthy();
    expect(screen.queryByText('Червоний')).toBeNull();
    const img = screen.getByRole('img', { name: 'Samsung' });
    expect(img.getAttribute('src')).toBe(
      resolveMediaUrl('property_option/x/samsung.png'),
    );
  });

  it('діалог видалення містить admin.properties.options.deleteWarning', async () => {
    render(<PropertyOptionsTable propertyId={ID.brand} />, { wrapper });
    const dialog = await openDelete('Apple');
    expect(
      within(dialog).getByText(t('admin.properties.options.deleteWarning')),
    ).toBeTruthy();
  });

  it('видалення опції: підтвердження → collection.delete(id); відмова сервера → тост, рядок повернувся', async () => {
    let reject!: (e: unknown) => void;
    removePropertyOptions.mockReturnValue(
      new Promise((_, rej) => {
        reject = rej;
      }),
    );
    render(<PropertyOptionsTable propertyId={ID.brand} />, { wrapper });
    const dialog = await openDelete('Apple');
    fireEvent.click(
      within(dialog).getByRole('button', { name: t('common.delete') }),
    );
    await waitFor(() => expect(screen.queryByText('Apple')).toBeNull());
    expect(removePropertyOptions).toHaveBeenCalledWith({
      data: [{ id: ID.apple }],
    });
    reject(new Error('boom'));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(`${t('common.error')} boom`),
    );
    expect(toastSuccess).not.toHaveBeenCalled();
    await screen.findByText('Apple');
  });

  it('видалення успішне → тост admin.properties.options.deleted', async () => {
    removePropertyOptions.mockImplementation(
      async ({ data }: { data: { id: string }[] }) => {
        for (const d of data) srv.remove(d.id);
      },
    );
    render(<PropertyOptionsTable propertyId={ID.brand} />, { wrapper });
    const dialog = await openDelete('Apple');
    fireEvent.click(
      within(dialog).getByRole('button', { name: t('common.delete') }),
    );
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(
        t('admin.properties.options.deleted'),
      ),
    );
    expect(screen.queryByText('Apple')).toBeNull();
    // Ревалідація (TSDB-1) віддає стан сервера — опція не повертається.
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText('Apple')).toBeNull();
  });
});
