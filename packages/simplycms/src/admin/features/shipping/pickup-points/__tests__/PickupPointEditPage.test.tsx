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
import { METHODS, POINTS, ZONES, stubDom, wrapper } from './render-support';

stubDom();

const { toastError, toastSuccess, navigate, params } = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  navigate: vi.fn(),
  params: { pointId: 'new' },
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
  listPickupPoints: vi.fn(),
  insertPickupPoints: vi.fn(),
  updatePickupPoints: vi.fn(),
  removePickupPoints: vi.fn(),
  listShippingZones: vi.fn(),
  listShippingMethods: vi.fn(),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock(m),
);

import PickupPointEditPage from '../PickupPointEditPage';

const t = createTranslator('uk');
const PICKUP_2 = {
  ...METHODS[1]!,
  id: 'b0000000-0000-4000-8000-000000000003',
  name: 'Укрпошта',
  sortOrder: 2,
};
const methodSelect = () =>
  screen.getByLabelText(t('admin.shipping.points.method')) as HTMLButtonElement;

beforeEach(() => {
  vi.clearAllMocks();
  params.pointId = 'new';
  m.listPickupPoints.mockResolvedValue(POINTS);
  m.listShippingZones.mockResolvedValue(ZONES);
  m.listShippingMethods.mockResolvedValue(METHODS);
  m.insertPickupPoints.mockImplementation(async ({ data }) => data);
});
afterEach(() => cleanup());

const fill = () => {
  fireEvent.change(screen.getByLabelText('Назва'), {
    target: { value: 'Нова точка' },
  });
  fireEvent.change(screen.getByLabelText('Місто'), {
    target: { value: 'Львів' },
  });
  fireEvent.change(screen.getByLabelText('Адреса'), {
    target: { value: 'вул. Т, 1' },
  });
};

describe('PickupPointEditPage', () => {
  it('select способу не містить адресних способів; один спосіб самовивозу — автовибір', async () => {
    render(<PickupPointEditPage />, { wrapper });
    await waitFor(() =>
      expect(methodSelect().textContent).toContain('Нова пошта'),
    );
    fireEvent.keyDown(methodSelect(), { key: 'Enter' });
    const options = await screen.findAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['Нова пошта']);
    expect(screen.queryByText("Кур'єр")).toBeNull();
  });

  it('створення: insert з methodId автовибраного способу, crypto id, без isSystem', async () => {
    render(<PickupPointEditPage />, { wrapper });
    await waitFor(() =>
      expect(methodSelect().textContent).toContain('Нова пошта'),
    );
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Створити' }));
    await waitFor(() => expect(m.insertPickupPoints).toHaveBeenCalled());
    const [{ data }] = m.insertPickupPoints.mock.calls[0] as [
      { data: Array<Record<string, unknown>> },
    ];
    expect(data[0]!.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(data[0]).toMatchObject({
      methodId: METHODS[1]!.id,
      name: 'Нова точка',
      city: 'Львів',
      zoneId: null,
      isSystem: false,
    });
  });

  it('два способи самовивозу: автовибору немає, без вибору форма не зберігається', async () => {
    m.listShippingMethods.mockResolvedValue([...METHODS, PICKUP_2]);
    render(<PickupPointEditPage />, { wrapper });
    await waitFor(() => expect(m.listShippingMethods).toHaveBeenCalled());
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Створити' }));
    await screen.findByText(t('admin.shipping.points.methodRequired'));
    expect(m.insertPickupPoints).not.toHaveBeenCalled();
  });

  it('збережена точка: спосіб лише показується; update без methodId', async () => {
    params.pointId = POINTS[1]!.id;
    m.updatePickupPoints.mockImplementation(async () => [
      { ...POINTS[1]!, name: 'В5' },
    ]);
    render(<PickupPointEditPage />, { wrapper });
    await screen.findByDisplayValue('Відділення 5');
    expect(methodSelect().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Назва'), {
      target: { value: 'В5' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }));
    await waitFor(() => expect(m.updatePickupPoints).toHaveBeenCalled());
    const [{ data }] = m.updatePickupPoints.mock.calls[0] as [
      { data: Array<{ patch: Record<string, unknown> }> },
    ];
    expect(data[0]!.patch).toEqual({ name: 'В5' });
  });

  it('системна точка: бейдж, видалення на картці немає', async () => {
    params.pointId = POINTS[0]!.id;
    render(<PickupPointEditPage />, { wrapper });
    await screen.findByDisplayValue('Склад');
    expect(screen.getByText(t('admin.shipping.points.system'))).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: t('common.delete') }),
    ).toBeNull();
  });
});
