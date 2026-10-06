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
import { ZONES, stateConflict, stubDom, wrapper } from './render-support';

stubDom();

const { toastError, toastSuccess, navigate, params } = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  navigate: vi.fn(),
  params: { zoneId: 'new' },
}));
vi.mock('sonner', () => ({
  toast: { error: toastError, success: toastSuccess },
}));
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
  useParams: () => params,
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

const m = vi.hoisted(() => ({
  listShippingZones: vi.fn(),
  insertShippingZones: vi.fn(),
  updateShippingZones: vi.fn(),
  removeShippingZones: vi.fn(),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock(m),
);

import ShippingZoneEditPage from '../ShippingZoneEditPage';

const t = createTranslator('uk');

beforeEach(() => {
  vi.clearAllMocks();
  params.zoneId = 'new';
  m.listShippingZones.mockResolvedValue(ZONES);
  m.insertShippingZones.mockImplementation(async ({ data }) => data);
});
afterEach(() => cleanup());

describe('ShippingZoneEditPage', () => {
  it('створення: міста й області рядком → text[], id від клієнта, isDefault=false', async () => {
    render(<ShippingZoneEditPage />, { wrapper });
    fireEvent.change(screen.getByLabelText('Назва'), {
      target: { value: 'Дніпро' },
    });
    fireEvent.change(screen.getByLabelText(t('admin.shipping.zones.cities')), {
      target: { value: 'Дніпро, Камʼянське\nПавлоград' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Створити' }));
    await waitFor(() => expect(m.insertShippingZones).toHaveBeenCalled());
    const [{ data }] = m.insertShippingZones.mock.calls[0] as [
      { data: Array<Record<string, unknown>> },
    ];
    expect(data[0]!.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(data[0]).toMatchObject({
      name: 'Дніпро',
      cities: ['Дніпро', 'Камʼянське', 'Павлоград'],
      regions: [],
    });
    expect(data[0]).toMatchObject({ isDefault: false });
  });

  it('редагування: update лише зі зміненим полем', async () => {
    params.zoneId = ZONES[1]!.id;
    m.updateShippingZones.mockImplementation(async () => [
      { ...ZONES[1]!, name: 'Львів+' },
    ]);
    render(<ShippingZoneEditPage />, { wrapper });
    await screen.findByDisplayValue('Львів');
    fireEvent.change(screen.getByLabelText('Назва'), {
      target: { value: 'Львів+' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }));
    await waitFor(() => expect(m.updateShippingZones).toHaveBeenCalled());
    const [{ data }] = m.updateShippingZones.mock.calls[0] as [
      { data: Array<{ patch: Record<string, unknown> }> },
    ];
    expect(data[0]!.patch).toEqual({ name: 'Львів+' });
  });

  it('дефолтна зона: видалення вимкнене; 409 при вимкненні — тост, лишаємось на картці', async () => {
    params.zoneId = ZONES[0]!.id;
    m.updateShippingZones.mockRejectedValue(
      stateConflict('shipping_zone_default'),
    );
    render(<ShippingZoneEditPage />, { wrapper });
    await screen.findByDisplayValue('Київ');
    expect(
      (
        screen.getByRole('button', {
          name: t('common.delete'),
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('switch'));
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        t('admin.errors.shippingZoneDefault'),
      ),
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it('невідомий id → стан «не знайдено», форми немає', async () => {
    params.zoneId = 'c0000000-0000-4000-8000-0000000000ff';
    render(<ShippingZoneEditPage />, { wrapper });
    await screen.findByText(t('admin.shipping.zones.notFound'));
    expect(screen.queryByRole('button', { name: 'Створити' })).toBeNull();
  });
});
