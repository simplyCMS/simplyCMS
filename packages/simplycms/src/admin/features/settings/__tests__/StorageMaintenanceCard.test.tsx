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
import { QueryClient } from '@tanstack/react-query';
import { createTranslator } from 'simplycms/i18n';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';
import { makeWrapper } from './render-support';

const { toastError, toastSuccess } = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: { error: toastError, success: toastSuccess },
}));

const mocks = vi.hoisted(() => ({
  listMediaErasures: vi.fn(),
  retryMediaErasures: vi.fn(),
  sweepUnreferencedMedia: vi.fn(),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock(mocks),
);

import { StorageMaintenanceCard } from '../StorageMaintenanceCard';

const t = createTranslator('uk', 'uk');
const KEY = entityKey(ENTITY.mediaErasures).all();
const TAIL = {
  storageKey: 'ab/x.png',
  attempts: 2,
  lastError: 'disk full',
  requestedAt: new Date('2026-10-01T10:00:00Z'),
};
let client: QueryClient;

beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(cleanup);

describe('StorageMaintenanceCard (Е6д-20)', () => {
  it('показує лічильник і хвости з помилкою', async () => {
    mocks.listMediaErasures.mockResolvedValue([TAIL]);
    render(<StorageMaintenanceCard />, { wrapper: makeWrapper(client) });
    expect(
      await screen.findByText(t('admin.settings.storage.count', { count: 1 })),
    ).toBeTruthy();
    expect(screen.getByText('ab/x.png')).toBeTruthy();
    expect(screen.getByText(/disk full/)).toBeTruthy();
  });

  it('порожній список → кнопка вимкнена', async () => {
    mocks.listMediaErasures.mockResolvedValue([]);
    render(<StorageMaintenanceCard />, { wrapper: makeWrapper(client) });
    await screen.findByText(t('admin.settings.storage.count', { count: 0 }));
    const btn = screen.getByRole('button', {
      name: t('admin.settings.storage.retry'),
    }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('кнопка кличе повтор, список інвалідується й перечитується', async () => {
    mocks.listMediaErasures.mockResolvedValueOnce([TAIL]).mockResolvedValue([]);
    mocks.retryMediaErasures.mockResolvedValue({ done: 1, failed: 0 });
    const spy = vi.spyOn(client, 'invalidateQueries');
    render(<StorageMaintenanceCard />, { wrapper: makeWrapper(client) });
    await screen.findByText('ab/x.png');
    fireEvent.click(
      screen.getByRole('button', { name: t('admin.settings.storage.retry') }),
    );
    await waitFor(() => expect(mocks.retryMediaErasures).toHaveBeenCalled());
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: KEY }));
    expect(
      await screen.findByText(t('admin.settings.storage.count', { count: 0 })),
    ).toBeTruthy();
    expect(toastSuccess).toHaveBeenCalledWith(
      t('admin.settings.storage.retried', { done: 1, failed: 0 }),
    );
  });

  it('sweep: діалог підтвердження, без підтвердження не кличеться; після — тост з кількістю', async () => {
    mocks.listMediaErasures.mockResolvedValue([]);
    mocks.sweepUnreferencedMedia.mockResolvedValue({ erased: 3 });
    const spy = vi.spyOn(client, 'invalidateQueries');
    render(<StorageMaintenanceCard />, { wrapper: makeWrapper(client) });
    await screen.findByText(t('admin.settings.storage.count', { count: 0 }));
    fireEvent.click(
      screen.getByRole('button', { name: t('admin.settings.storage.sweep') }),
    );
    const dialog = await screen.findByRole('alertdialog');
    // Без підтвердження виклику немає.
    expect(mocks.sweepUnreferencedMedia).not.toHaveBeenCalled();
    fireEvent.click(
      within(dialog).getByRole('button', {
        name: t('admin.settings.storage.sweep'),
      }),
    );
    await waitFor(() =>
      expect(mocks.sweepUnreferencedMedia).toHaveBeenCalled(),
    );
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: KEY }));
    expect(toastSuccess).toHaveBeenCalledWith(
      t('admin.settings.storage.swept', { count: 3 }),
    );
  });

  it('дата хвоста підписана як остання спроба', async () => {
    mocks.listMediaErasures.mockResolvedValue([TAIL]);
    render(<StorageMaintenanceCard />, { wrapper: makeWrapper(client) });
    expect(await screen.findByText(/остання/)).toBeTruthy();
  });
});
