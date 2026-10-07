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
  CATEGORIES,
  CATEGORY_ID,
  COUNTS,
  stateConflict,
  stubDom,
  wrapper,
} from '../../__tests__/render-support';

stubDom();

const { toastError, toastSuccess } = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: { error: toastError, success: toastSuccess },
}));
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

const m = vi.hoisted(() => ({
  listUserCategories: vi.fn(),
  listPriceTypes: vi.fn(),
  countCustomersByCategory: vi.fn(),
  setDefaultUserCategory: vi.fn(),
  removeUserCategories: vi.fn(),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock(m),
);

import UserCategoriesPage from '../UserCategoriesPage';

const t = createTranslator('uk');
const rowOf = (name: string) => screen.getByText(name).closest('tr')!;

beforeEach(() => {
  vi.clearAllMocks();
  m.listUserCategories.mockResolvedValue(CATEGORIES);
  m.listPriceTypes.mockResolvedValue([]);
  m.countCustomersByCategory.mockResolvedValue(COUNTS);
});
afterEach(() => cleanup());

describe('UserCategoriesPage', () => {
  it('рядок: бейдж дефолтної й кількість покупців із countCustomersByCategory', async () => {
    render(<UserCategoriesPage />, { wrapper });
    await screen.findByText('Опт');
    expect(
      within(rowOf('Роздріб')).getByText(t('common.byDefault')),
    ).toBeTruthy();
    await waitFor(() =>
      expect(within(rowOf('Роздріб')).getByText('5')).toBeTruthy(),
    );
    expect(within(rowOf('Опт')).getByText('2')).toBeTruthy();
  });

  it('кнопки видалення дефолтної категорії немає, у решти — є', async () => {
    render(<UserCategoriesPage />, { wrapper });
    await screen.findByText('Опт');
    const del = t('common.delete');
    expect(
      within(rowOf('Роздріб')).queryByRole('button', { name: del }),
    ).toBeNull();
    expect(
      within(rowOf('Опт')).getByRole('button', { name: del }),
    ).toBeTruthy();
  });

  it('«Зробити дефолтною» → setDefaultUserCategory, бейдж переходить без refetch списку', async () => {
    m.setDefaultUserCategory.mockResolvedValue({
      rows: [
        { ...CATEGORIES[0]!, isDefault: false },
        { ...CATEGORIES[1]!, isDefault: true },
      ],
    });
    render(<UserCategoriesPage />, { wrapper });
    await screen.findByText('Опт');
    fireEvent.click(
      within(rowOf('Опт')).getByRole('button', {
        name: t('admin.customerCategories.categories.makeDefault'),
      }),
    );
    await waitFor(() =>
      expect(
        within(rowOf('Опт')).getByText(t('common.byDefault')),
      ).toBeTruthy(),
    );
    expect(m.setDefaultUserCategory).toHaveBeenCalledWith({
      data: { id: CATEGORY_ID.wholesale },
    });
    expect(m.listUserCategories).toHaveBeenCalledTimes(1);
  });

  it('409 user_category_has_customers → тост «У категорії є покупці…»', async () => {
    m.removeUserCategories.mockRejectedValue(
      stateConflict('user_category_has_customers'),
    );
    render(<UserCategoriesPage />, { wrapper });
    await screen.findByText('Опт');
    fireEvent.click(
      within(rowOf('Опт')).getByRole('button', { name: t('common.delete') }),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: t('common.delete') }),
    );
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        t('admin.errors.userCategoryHasCustomers'),
      ),
    );
    expect(t('admin.errors.userCategoryHasCustomers')).toContain(
      'У категорії є покупці',
    );
  });
});
