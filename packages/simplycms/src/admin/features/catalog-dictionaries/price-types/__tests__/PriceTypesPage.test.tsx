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
import { ROWS, wrapper } from './render-support';

const { toastError, toastSuccess } = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: { error: toastError, success: toastSuccess },
}));
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }));

const { listPriceTypes, removePriceTypes } = vi.hoisted(() => ({
  listPriceTypes: vi.fn(),
  removePriceTypes: vi.fn(),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock({ listPriceTypes, removePriceTypes }),
);

import PriceTypesPage from '../PriceTypesPage';

beforeEach(() => {
  vi.clearAllMocks();
  listPriceTypes.mockResolvedValue(ROWS);
});
afterEach(() => cleanup());

const t = createTranslator('uk');

describe('PriceTypesPage', () => {
  it('кнопка видалення дефолтного типу disabled', async () => {
    render(<PriceTypesPage />, { wrapper });
    await screen.findByText('Роздріб');
    const buttons = screen.getAllByRole('button', { name: 'Видалити' });
    expect((buttons[0] as HTMLButtonElement).disabled).toBe(true);
    expect((buttons[1] as HTMLButtonElement).disabled).toBe(false);
  });

  it('діалог видалення несе текст-попередження про RESTRICT', async () => {
    render(<PriceTypesPage />, { wrapper });
    await screen.findByText('Опт');
    fireEvent.click(screen.getAllByRole('button', { name: 'Видалити' })[1]!);
    const dialog = await screen.findByRole('alertdialog');
    expect(
      within(dialog).getByText(t('admin.prices.deleteWarning')),
    ).toBeTruthy();
  });

  it('409 reference: рядок зникає оптимістично, тост — точний текст, рядок повертається', async () => {
    let reject!: (e: unknown) => void;
    removePriceTypes.mockReturnValue(
      new Promise((_, rej) => {
        reject = rej;
      }),
    );
    render(<PriceTypesPage />, { wrapper });
    await screen.findByText('Опт');
    fireEvent.click(screen.getAllByRole('button', { name: 'Видалити' })[1]!);
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Видалити' }));
    await waitFor(() => expect(screen.queryByText('Опт')).toBeNull());
    reject(
      Object.assign(new Error('fk'), {
        name: 'AdminConflictError',
        kind: 'reference',
      }),
    );
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        t('admin.errors.conflictReference'),
      ),
    );
    expect(toastSuccess).not.toHaveBeenCalled();
    await screen.findByText('Опт');
  });
});
