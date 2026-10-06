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
  POINTS,
  ZONES,
  stateConflict,
  stubDom,
  wrapper,
} from './render-support';

stubDom();

const { toastError, toastSuccess } = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: { error: toastError, success: toastSuccess },
}));
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }));

const m = vi.hoisted(() => ({
  listPickupPoints: vi.fn(),
  updatePickupPoints: vi.fn(),
  removePickupPoints: vi.fn(),
  listShippingZones: vi.fn(),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock(m),
);

import PickupPointsPage from '../PickupPointsPage';

const t = createTranslator('uk');
const rowOf = (name: string) => screen.getByText(name).closest('tr')!;

beforeEach(() => {
  vi.clearAllMocks();
  m.listPickupPoints.mockResolvedValue(POINTS);
  m.listShippingZones.mockResolvedValue(ZONES);
});
afterEach(() => cleanup());

describe('PickupPointsPage', () => {
  it('системна точка: бейдж і жодної кнопки видалення; у звичайної — є', async () => {
    render(<PickupPointsPage />, { wrapper });
    await screen.findByText('Відділення 5');
    expect(
      within(rowOf('Склад')).getByText(t('admin.shipping.points.system')),
    ).toBeTruthy();
    expect(
      within(rowOf('Склад')).queryByRole('button', {
        name: t('common.delete'),
      }),
    ).toBeNull();
    expect(
      within(rowOf('Відділення 5')).getByRole('button', {
        name: t('common.delete'),
      }),
    ).toBeTruthy();
  });

  it('назва зони береться з колекції зон', async () => {
    render(<PickupPointsPage />, { wrapper });
    await screen.findByText('Склад');
    await waitFor(() =>
      expect(within(rowOf('Склад')).getByText('Київ', { selector: 'div' })),
    );
  });

  it('409 pickup_point_has_stock при видаленні: точний тост, рядок повертається', async () => {
    m.removePickupPoints.mockRejectedValue(
      stateConflict('pickup_point_has_stock'),
    );
    render(<PickupPointsPage />, { wrapper });
    await screen.findByText('Відділення 5');
    fireEvent.click(
      within(rowOf('Відділення 5')).getByRole('button', {
        name: t('common.delete'),
      }),
    );
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(
      within(dialog).getByRole('button', { name: t('common.delete') }),
    );
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        t('admin.errors.pickupPointHasStock'),
      ),
    );
    expect(toastSuccess).not.toHaveBeenCalled();
    await screen.findByText('Відділення 5');
  });

  it('перемикач активності пише update { isActive }', async () => {
    m.updatePickupPoints.mockImplementation(async () => [
      { ...POINTS[1]!, isActive: false },
    ]);
    render(<PickupPointsPage />, { wrapper });
    await screen.findByText('Відділення 5');
    fireEvent.click(within(rowOf('Відділення 5')).getByRole('switch'));
    await waitFor(() => expect(m.updatePickupPoints).toHaveBeenCalled());
    const [{ data }] = m.updatePickupPoints.mock.calls[0] as [
      { data: Array<{ id: string; patch: unknown }> },
    ];
    expect(data[0]).toEqual({ id: POINTS[1]!.id, patch: { isActive: false } });
  });
});
