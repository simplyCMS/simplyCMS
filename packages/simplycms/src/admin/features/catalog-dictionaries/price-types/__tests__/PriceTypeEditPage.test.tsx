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

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const { toastError, toastSuccess, navigate, params } = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  navigate: vi.fn(),
  params: { priceTypeId: 'new' },
}));
vi.mock('sonner', () => ({
  toast: { error: toastError, success: toastSuccess },
}));
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
  useParams: () => params,
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

const {
  listPriceTypes,
  insertPriceTypes,
  updatePriceTypes,
  setDefaultPriceType,
} = vi.hoisted(() => ({
  listPriceTypes: vi.fn(),
  insertPriceTypes: vi.fn(),
  updatePriceTypes: vi.fn(),
  setDefaultPriceType: vi.fn(),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock({
    listPriceTypes,
    insertPriceTypes,
    updatePriceTypes,
    setDefaultPriceType,
  }),
);

import PriceTypeEditPage from '../PriceTypeEditPage';

const fill = (name: string, code: string) => {
  fireEvent.change(screen.getByLabelText('Назва'), { target: { value: name } });
  fireEvent.change(screen.getByLabelText('Код'), { target: { value: code } });
};

beforeEach(() => {
  vi.clearAllMocks();
  params.priceTypeId = 'new';
  listPriceTypes.mockResolvedValue(ROWS);
  insertPriceTypes.mockImplementation(async ({ data }) => data);
});
afterEach(() => cleanup());

describe('PriceTypeEditPage', () => {
  it('створення: insert з crypto id; isDefault=true → після персисту setDefaultPriceType', async () => {
    const order: string[] = [];
    insertPriceTypes.mockImplementation(async ({ data }) => {
      order.push('insert');
      return data;
    });
    setDefaultPriceType.mockImplementation(async () => {
      order.push('setDefault');
      return { rows: [] };
    });
    render(<PriceTypeEditPage />, { wrapper });
    fill('VIP', 'vip');
    fireEvent.click(screen.getByRole('switch'));
    fireEvent.click(screen.getByRole('button', { name: 'Створити' }));
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(order).toEqual(['insert', 'setDefault']);
    const [{ data }] = insertPriceTypes.mock.calls[0] as [
      { data: Array<{ id: string; isDefault: boolean; code: string }> },
    ];
    expect(data[0]!.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(data[0]!.isDefault).toBe(false);
    expect(setDefaultPriceType).toHaveBeenCalledWith({
      data: { id: data[0]!.id },
    });
  });

  it('падіння setDefault — окремий тост, рядок уже створено', async () => {
    setDefaultPriceType.mockRejectedValue(new Error('boom'));
    render(<PriceTypeEditPage />, { wrapper });
    fill('VIP', 'vip');
    fireEvent.click(screen.getByRole('switch'));
    fireEvent.click(screen.getByRole('button', { name: 'Створити' }));
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(toastSuccess).toHaveBeenCalled();
  });

  it('зняти перемикач у дефолтного неможливо — контрол disabled із підказкою', async () => {
    params.priceTypeId = ROWS[0]!.id;
    render(<PriceTypeEditPage />, { wrapper });
    const sw = await screen.findByRole('switch');
    await waitFor(() => expect((sw as HTMLButtonElement).disabled).toBe(true));
    expect(sw.getAttribute('title')).toBeTruthy();
  });

  it('невалідний code → помилка біля поля, insert не викликано', async () => {
    render(<PriceTypeEditPage />, { wrapper });
    fill('VIP', 'b2b-x');
    fireEvent.click(screen.getByRole('button', { name: 'Створити' }));
    await screen.findByText('Лише латиниця, цифри й _');
    expect(insertPriceTypes).not.toHaveBeenCalled();
  });
});
