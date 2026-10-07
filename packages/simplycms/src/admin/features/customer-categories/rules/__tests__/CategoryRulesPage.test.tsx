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
import {
  CATEGORIES,
  RULES,
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
  listCategoryRules: vi.fn(),
  listUserCategories: vi.fn(),
  runCategoryRules: vi.fn(),
  updateCategoryRules: vi.fn(),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock(m),
);

import CategoryRulesPage from '../CategoryRulesPage';

const t = createTranslator('uk');
const run = () =>
  fireEvent.click(
    screen.getByRole('button', {
      name: t('admin.customerCategories.rules.run'),
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  m.listCategoryRules.mockResolvedValue(RULES);
  m.listUserCategories.mockResolvedValue(CATEGORIES);
});
afterEach(() => cleanup());

describe('CategoryRulesPage', () => {
  it('рядок правила: назва, перехід «будь-яка → VIP», пріоритет', async () => {
    render(<CategoryRulesPage />, { wrapper });
    await screen.findByText('VIP за сумою');
    await screen.findByText('VIP');
    expect(screen.getByText(t('admin.users.rules.any'))).toBeTruthy();
    expect(screen.getByText('10')).toBeTruthy();
  });

  it('«Запустити всі» → тост із числами з відповіді', async () => {
    m.runCategoryRules.mockResolvedValue({ checked: 7, changed: 3, failed: 0 });
    render(<CategoryRulesPage />, { wrapper });
    await screen.findByText('VIP за сумою');
    run();
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(
        t('admin.customerCategories.rules.runResult', {
          checked: 7,
          changed: 3,
        }),
      ),
    );
    expect(toastError).not.toHaveBeenCalled();
  });

  it('failed: 2 → окремий тост «2 покупців не оброблено — дивіться журнал сервера»', async () => {
    m.runCategoryRules.mockResolvedValue({ checked: 7, changed: 3, failed: 2 });
    render(<CategoryRulesPage />, { wrapper });
    await screen.findByText('VIP за сумою');
    run();
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        '2 покупців не оброблено — дивіться журнал сервера',
      ),
    );
    expect(toastSuccess).toHaveBeenCalledWith('Перевірено: 7, змінено: 3');
  });
});
