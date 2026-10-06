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
import { METHODS, RATES, ZONES, stubDom, wrapper } from './render-support';

stubDom();

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const m = vi.hoisted(() => ({
  listShippingZones: vi.fn(),
  listShippingRates: vi.fn(),
  insertShippingRates: vi.fn(),
  updateShippingRates: vi.fn(),
  removeShippingRates: vi.fn(),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock(m),
);

import { ShippingRatesTable } from '../ShippingRatesTable';

const t = createTranslator('uk');
const methodId = METHODS[0]!.id;

beforeEach(() => {
  vi.clearAllMocks();
  m.listShippingZones.mockResolvedValue(ZONES);
  m.listShippingRates.mockResolvedValue(RATES);
  m.insertShippingRates.mockImplementation(async ({ data }) => data);
});
afterEach(() => cleanup());

const change = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('ShippingRatesTable', () => {
  it('рядок «зона → тариф»; правка base_cost і free_from пишеться update-ом колекції', async () => {
    m.updateShippingRates.mockImplementation(async () => [RATES[0]]);
    render(<ShippingRatesTable methodId={methodId} />, { wrapper });
    await screen.findByText('Стандарт');
    expect(screen.getByText('Київ')).toBeTruthy();
    // Гроші — через useFormatPrice, не сирий numeric-рядок '50.00'.
    expect(screen.getByText(/^50(,00)?\s*₴$/)).toBeTruthy();
    expect(screen.queryByText('50.00')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: t('common.edit') }));
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog)
        .getByLabelText(t('admin.shipping.points.zone'))
        .hasAttribute('disabled'),
    ).toBe(true);
    change(t('admin.shipping.rates.baseCost'), '75.5');
    change(t('admin.shipping.rates.freeFrom'), '1000');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Зберегти' }));
    await waitFor(() => expect(m.updateShippingRates).toHaveBeenCalled());
    const [{ data }] = m.updateShippingRates.mock.calls[0] as [
      { data: Array<{ id: string; patch: Record<string, unknown> }> },
    ];
    expect(data[0]!.id).toBe(RATES[0]!.id);
    expect(data[0]!.patch).toEqual({
      baseCost: '75.5',
      freeFromAmount: '1000',
    });
  });

  it('додавання без зони відхиляється; із зоною — insert з crypto id, methodId і zoneId', async () => {
    render(<ShippingRatesTable methodId={methodId} />, { wrapper });
    await screen.findByText('Стандарт');
    fireEvent.click(
      screen.getByRole('button', { name: t('admin.shipping.rates.add') }),
    );
    const dialog = await screen.findByRole('dialog');
    change(t('common.name'), 'Експрес');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Зберегти' }));
    await screen.findByText(t('admin.shipping.rates.zoneRequired'));
    expect(m.insertShippingRates).not.toHaveBeenCalled();

    fireEvent.keyDown(
      within(dialog).getByLabelText(t('admin.shipping.points.zone')),
      { key: 'Enter' },
    );
    fireEvent.click(await screen.findByRole('option', { name: 'Київ' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Зберегти' }));
    await waitFor(() => expect(m.insertShippingRates).toHaveBeenCalled());
    const [{ data }] = m.insertShippingRates.mock.calls[0] as [
      { data: Array<Record<string, unknown>> },
    ];
    expect(data[0]!.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(data[0]).toMatchObject({
      methodId,
      zoneId: ZONES[0]!.id,
      name: 'Експрес',
      baseCost: '0',
    });
  });

  it('видалення тарифу — через колекцію після підтвердження', async () => {
    m.removeShippingRates.mockResolvedValue({ rows: [] });
    render(<ShippingRatesTable methodId={methodId} />, { wrapper });
    await screen.findByText('Стандарт');
    fireEvent.click(screen.getByRole('button', { name: t('common.delete') }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(
      within(dialog).getByRole('button', { name: t('common.delete') }),
    );
    await waitFor(() => expect(m.removeShippingRates).toHaveBeenCalled());
  });
});
