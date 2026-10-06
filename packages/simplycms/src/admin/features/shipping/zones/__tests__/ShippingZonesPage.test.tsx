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
import { ZONES, stateConflict, stubDom, wrapper } from './render-support';

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
  listShippingZones: vi.fn(),
  updateShippingZones: vi.fn(),
  removeShippingZones: vi.fn(),
  setDefaultShippingZone: vi.fn(),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock(m),
);

import ShippingZonesPage from '../ShippingZonesPage';

const t = createTranslator('uk');
const rowOf = (name: string) => screen.getByText(name).closest('tr')!;
const badge = t('common.byDefault');

beforeEach(() => {
  vi.clearAllMocks();
  m.listShippingZones.mockResolvedValue(ZONES);
});
afterEach(() => cleanup());

describe('ShippingZonesPage', () => {
  it('«Зробити дефолтною»: бейдж переходить між рядками без refetch', async () => {
    m.setDefaultShippingZone.mockResolvedValue({
      rows: [
        { ...ZONES[0]!, isDefault: false },
        { ...ZONES[1]!, isDefault: true },
      ],
    });
    render(<ShippingZonesPage />, { wrapper });
    await screen.findByText('Львів');
    expect(within(rowOf('Київ')).getByText(badge)).toBeTruthy();
    fireEvent.click(
      within(rowOf('Львів')).getByRole('button', {
        name: t('admin.shipping.zones.makeDefault'),
      }),
    );
    await waitFor(() =>
      expect(within(rowOf('Львів')).getByText(badge)).toBeTruthy(),
    );
    expect(within(rowOf('Київ')).queryByText(badge)).toBeNull();
    expect(m.listShippingZones).toHaveBeenCalledTimes(1);
  });

  it('вимкнену зону не можна зробити дефолтною (кнопка disabled, Е6а-20)', async () => {
    render(<ShippingZonesPage />, { wrapper });
    await screen.findByText('Одеса');
    const btn = within(rowOf('Одеса')).getByRole('button', {
      name: t('admin.shipping.zones.makeDefault'),
    }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('дефолтну зону не можна видалити: кнопка disabled, у решти — активна', async () => {
    render(<ShippingZonesPage />, { wrapper });
    await screen.findByText('Київ');
    const del = (n: string) =>
      within(rowOf(n)).getByRole('button', {
        name: t('common.delete'),
      }) as HTMLButtonElement;
    expect(del('Київ').disabled).toBe(true);
    expect(del('Львів').disabled).toBe(false);
    // Причину вимкнення озвучує опис, а не `title` (його читачі пропускають).
    const hint = del('Київ').getAttribute('aria-describedby');
    expect(hint && document.getElementById(hint)?.textContent).toBe(
      t('admin.shipping.zones.defaultLocked'),
    );
    expect(del('Львів').getAttribute('aria-describedby')).toBeNull();
  });

  it('вимкнення дефолтної: 409 shipping_zone_default → точний тост, рядок повертається', async () => {
    m.updateShippingZones.mockRejectedValue(
      stateConflict('shipping_zone_default'),
    );
    render(<ShippingZonesPage />, { wrapper });
    await screen.findByText('Київ');
    fireEvent.click(within(rowOf('Київ')).getByRole('switch'));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        t('admin.errors.shippingZoneDefault'),
      ),
    );
    expect(toastSuccess).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(
        within(rowOf('Київ')).getByRole('switch').getAttribute('aria-checked'),
      ).toBe('true'),
    );
  });

  it('видалення через діалог: removeShippingZones з id', async () => {
    m.removeShippingZones.mockResolvedValue(undefined);
    render(<ShippingZonesPage />, { wrapper });
    await screen.findByText('Львів');
    fireEvent.click(
      within(rowOf('Львів')).getByRole('button', { name: t('common.delete') }),
    );
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(
      within(dialog).getByRole('button', { name: t('common.delete') }),
    );
    await waitFor(() => expect(m.removeShippingZones).toHaveBeenCalled());
  });
});
