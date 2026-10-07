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
import { CATEGORIES, stubDom, wrapper } from '../../__tests__/render-support';

stubDom();

const { toastError, toastSuccess, navigate, params } = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  navigate: vi.fn(),
  params: { categoryId: 'new' },
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
  listUserCategories: vi.fn(),
  listPriceTypes: vi.fn(),
  insertUserCategories: vi.fn(),
  updateUserCategories: vi.fn(),
  removeUserCategories: vi.fn(),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock(m),
);

import UserCategoryEditPage from '../UserCategoryEditPage';

const t = createTranslator('uk');

beforeEach(() => {
  vi.clearAllMocks();
  params.categoryId = 'new';
  m.listUserCategories.mockResolvedValue(CATEGORIES);
  m.listPriceTypes.mockResolvedValue([]);
  m.insertUserCategories.mockImplementation(async ({ data }) => data);
});
afterEach(() => cleanup());

describe('UserCategoryEditPage', () => {
  it('створення: id від клієнта, isDefault=false (дефолт ставить кнопка списку)', async () => {
    render(<UserCategoryEditPage />, { wrapper });
    fireEvent.change(screen.getByLabelText(t('common.name')), {
      target: { value: 'Партнер' },
    });
    fireEvent.change(screen.getByLabelText(t('common.code')), {
      target: { value: 'partner' },
    });
    fireEvent.click(screen.getByRole('button', { name: t('common.create') }));
    await waitFor(() => expect(m.insertUserCategories).toHaveBeenCalled());
    const [{ data }] = m.insertUserCategories.mock.calls[0] as [
      { data: Array<Record<string, unknown>> },
    ];
    expect(data[0]).toMatchObject({
      name: 'Партнер',
      code: 'partner',
      description: null,
      priceTypeId: null,
    });
    expect(typeof data[0]!.id).toBe('string');
    expect(data[0]).toMatchObject({ isDefault: false });
  });

  it('картка дефолтної категорії не має кнопки видалення', async () => {
    params.categoryId = CATEGORIES[0]!.id;
    render(<UserCategoryEditPage />, { wrapper });
    await screen.findByDisplayValue('Роздріб');
    expect(
      screen.queryByRole('button', { name: t('common.delete') }),
    ).toBeNull();
  });
});
