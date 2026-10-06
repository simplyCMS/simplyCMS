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
import { METHODS, RATES, ZONES, stubDom, wrapper } from './render-support';

stubDom();

const { toastError, toastSuccess, navigate, params } = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  navigate: vi.fn(),
  params: { methodId: 'new' },
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
  listShippingMethods: vi.fn(),
  insertShippingMethods: vi.fn(),
  updateShippingMethods: vi.fn(),
  removeShippingMethods: vi.fn(),
  listShippingZones: vi.fn(),
  listShippingRates: vi.fn(),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock(m),
);

import ShippingMethodEditPage from '../ShippingMethodEditPage';

const t = createTranslator('uk');

beforeEach(() => {
  vi.clearAllMocks();
  params.methodId = 'new';
  m.listShippingMethods.mockResolvedValue(METHODS);
  m.listShippingZones.mockResolvedValue(ZONES);
  m.listShippingRates.mockResolvedValue(RATES);
  m.insertShippingMethods.mockImplementation(async ({ data }) => data);
});
afterEach(() => cleanup());
const fill = (name: string, code: string) => {
  fireEvent.change(screen.getByLabelText('Назва'), { target: { value: name } });
  fireEvent.change(screen.getByLabelText('Код'), { target: { value: code } });
};
const provider = () =>
  screen.getByLabelText(
    t('admin.shipping.methods.provider'),
  ) as HTMLButtonElement;

describe('ShippingMethodEditPage', () => {
  it('новий спосіб: провайдер активний, блоку тарифів немає', async () => {
    render(<ShippingMethodEditPage />, { wrapper });
    expect(provider().disabled).toBe(false);
    expect(screen.queryByText(t('admin.shipping.rates.title'))).toBeNull();
  });

  it('створення: insert із crypto id і провайдером, перехід на картку (pricing=rates)', async () => {
    render(<ShippingMethodEditPage />, { wrapper });
    fill('Нова пошта', 'np');
    fireEvent.click(screen.getByRole('button', { name: 'Створити' }));
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    const [{ data }] = m.insertShippingMethods.mock.calls[0] as [
      { data: Array<Record<string, unknown>> },
    ];
    expect(data[0]!.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(data[0]).toMatchObject({
      provider: 'core:address',
      code: 'np',
      pricing: 'rates',
    });
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ params: { methodId: data[0]!.id } }),
    );
  });

  it('збережений спосіб: провайдер лише показується, update без provider', async () => {
    params.methodId = METHODS[0]!.id;
    m.updateShippingMethods.mockImplementation(async () => [
      { ...METHODS[0]!, name: 'К2' },
    ]);
    render(<ShippingMethodEditPage />, { wrapper });
    await screen.findByDisplayValue("Кур'єр");
    expect(provider().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Назва'), {
      target: { value: 'К2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }));
    await waitFor(() => expect(m.updateShippingMethods).toHaveBeenCalled());
    const [{ data }] = m.updateShippingMethods.mock.calls[0] as [
      { data: Array<{ patch: Record<string, unknown> }> },
    ];
    expect(data[0]!.patch).toEqual({ name: 'К2' });
  });

  it('pricing=rates і збережений → блок тарифів; pricing=carrier → блоку немає', async () => {
    params.methodId = METHODS[0]!.id;
    const { unmount } = render(<ShippingMethodEditPage />, { wrapper });
    await screen.findByText(t('admin.shipping.rates.title'));
    unmount();
    cleanup();
    params.methodId = METHODS[1]!.id;
    render(<ShippingMethodEditPage />, { wrapper });
    await screen.findByDisplayValue('Нова пошта');
    expect(screen.queryByText(t('admin.shipping.rates.title'))).toBeNull();
  });

  it('режим provider недоступний, коли провайдер не вміє рахувати ціну; carrier має підпис Е6а-4', async () => {
    render(<ShippingMethodEditPage />, { wrapper });
    fireEvent.keyDown(
      screen.getByLabelText(t('admin.shipping.methods.pricing')),
      { key: 'Enter' },
    );
    const opt = await screen.findByRole('option', {
      name: t('admin.shipping.pricing.provider'),
    });
    expect(opt.getAttribute('aria-disabled')).toBe('true');
    expect(
      screen.getByRole('option', { name: 'За тарифами перевізника' }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole('option', { name: t('admin.shipping.pricing.rates') })
        .getAttribute('aria-disabled'),
    ).toBeNull();
  });

  it('невалідний code → помилка, insert не викликано', async () => {
    render(<ShippingMethodEditPage />, { wrapper });
    fill('X', 'a-b');
    fireEvent.click(screen.getByRole('button', { name: 'Створити' }));
    await screen.findByText(t('admin.shipping.methods.codeFormat'));
    expect(m.insertShippingMethods).not.toHaveBeenCalled();
  });
});
