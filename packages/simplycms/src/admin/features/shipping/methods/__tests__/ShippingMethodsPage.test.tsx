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
import { METHODS, stubDom, wrapper } from './render-support';

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
  listShippingMethods: vi.fn(),
  updateShippingMethods: vi.fn(),
  removeShippingMethods: vi.fn(),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock(m),
);

import ShippingMethodsPage from '../ShippingMethodsPage';

const t = createTranslator('uk');

beforeEach(() => {
  vi.clearAllMocks();
  m.listShippingMethods.mockResolvedValue(METHODS);
});
afterEach(() => cleanup());

describe('ShippingMethodsPage', () => {
  it('рядок: назва, провайдер, режим ціни (carrier — підпис Е6а-4), порядок', async () => {
    render(<ShippingMethodsPage />, { wrapper });
    await screen.findByText('Нова пошта');
    expect(
      screen.getByText(t('admin.shipping.providers.address')),
    ).toBeTruthy();
    expect(screen.getByText(t('admin.shipping.pricing.rates'))).toBeTruthy();
    expect(screen.getByText('За тарифами перевізника')).toBeTruthy();
  });

  it('перемикач активності пише update { isActive }', async () => {
    m.updateShippingMethods.mockImplementation(async () => [
      { ...METHODS[1]!, isActive: true },
    ]);
    render(<ShippingMethodsPage />, { wrapper });
    await screen.findByText("Кур'єр");
    fireEvent.click(screen.getAllByRole('switch')[1]!);
    await waitFor(() => expect(m.updateShippingMethods).toHaveBeenCalled());
    const [{ data }] = m.updateShippingMethods.mock.calls[0] as [
      { data: Array<{ id: string; patch: unknown }> },
    ];
    expect(data[0]).toEqual({ id: METHODS[1]!.id, patch: { isActive: true } });
  });

  it('409 reference при видаленні: точний тост, рядок повертається', async () => {
    m.removeShippingMethods.mockRejectedValue(
      Object.assign(new Error('fk'), {
        name: 'AdminConflictError',
        kind: 'reference',
      }),
    );
    render(<ShippingMethodsPage />, { wrapper });
    await screen.findByText('Нова пошта');
    fireEvent.click(screen.getAllByRole('button', { name: 'Видалити' })[1]!);
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Видалити' }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        t('admin.errors.conflictReference'),
      ),
    );
    expect(toastSuccess).not.toHaveBeenCalled();
    await screen.findByText('Нова пошта');
  });
});
