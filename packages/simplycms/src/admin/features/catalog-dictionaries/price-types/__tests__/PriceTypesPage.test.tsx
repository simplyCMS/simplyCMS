// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
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
  vi.stubGlobal('confirm', () => true);
});
afterEach(() => cleanup());

describe('PriceTypesPage', () => {
  it('кнопка видалення дефолтного типу disabled', async () => {
    render(<PriceTypesPage />, { wrapper });
    await screen.findByText('Роздріб');
    const buttons = screen.getAllByRole('button', { name: 'Видалити' });
    expect((buttons[0] as HTMLButtonElement).disabled).toBe(true);
    expect((buttons[1] as HTMLButtonElement).disabled).toBe(false);
  });

  it('відмова видалення з 409 reference → тост conflictReference, рядок повертається', async () => {
    removePriceTypes.mockRejectedValue(
      Object.assign(new Error('fk'), {
        name: 'AdminConflictError',
        kind: 'reference',
      }),
    );
    render(<PriceTypesPage />, { wrapper });
    await screen.findByText('Опт');
    fireEvent.click(screen.getAllByRole('button', { name: 'Видалити' })[1]!);
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(toastError.mock.calls[0]![0]).toMatch(/./);
    expect(toastSuccess).not.toHaveBeenCalled();
    await screen.findByText('Опт');
  });
});
