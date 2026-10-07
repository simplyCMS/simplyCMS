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
  CATEGORY_ID,
  stubDom,
  wrapper,
} from '../../__tests__/render-support';

stubDom();

const { toastError, toastSuccess, navigate, params } = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  navigate: vi.fn(),
  params: { ruleId: 'new' },
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
  listCategoryRules: vi.fn(),
  listUserCategories: vi.fn(),
  insertCategoryRules: vi.fn(),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock(m),
);

import CategoryRuleEditPage from '../CategoryRuleEditPage';

const t = createTranslator('uk');
const hint = () =>
  screen.queryByText(t('admin.customerCategories.rules.utmHint'));

/** Вибір опції Radix Select за доступним імʼям тригера. */
async function pick(trigger: string, option: string) {
  fireEvent.click(screen.getByRole('combobox', { name: trigger }));
  fireEvent.click(await screen.findByRole('option', { name: option }));
}

beforeEach(() => {
  vi.clearAllMocks();
  params.ruleId = 'new';
  m.listCategoryRules.mockResolvedValue([]);
  m.listUserCategories.mockResolvedValue(CATEGORIES);
  m.insertCategoryRules.mockImplementation(async ({ data }) => data);
});
afterEach(() => cleanup());

const addCondition = () =>
  fireEvent.click(
    screen.getByRole('button', { name: t('admin.users.rules.addCondition') }),
  );
const fieldTrigger = t('admin.users.rules.field');
const operatorTrigger = t('admin.users.rules.operator');

describe('CategoryRuleEditPage', () => {
  it('підказка UTM видна лише біля utm_source/utm_campaign', async () => {
    render(<CategoryRuleEditPage />, { wrapper });
    addCondition();
    expect(hint()).toBeNull();
    await pick(fieldTrigger, 'UTM Source');
    expect(hint()).toBeTruthy();
    await pick(fieldTrigger, t('admin.users.emailDomain'));
    expect(hint()).toBeNull();
    await pick(fieldTrigger, 'UTM Campaign');
    expect(hint()).toBeTruthy();
  });

  it('для auth_provider у виборі оператора лише «=»', async () => {
    render(<CategoryRuleEditPage />, { wrapper });
    addCondition();
    await pick(fieldTrigger, t('admin.users.rules.field.authProvider'));
    fireEvent.click(screen.getByRole('combobox', { name: operatorTrigger }));
    const options = await screen.findAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([
      t('admin.users.rules.op.equals'),
    ]);
  });

  it('збереження: умови проходять parseCategoryRuleConditions, id від клієнта', async () => {
    render(<CategoryRuleEditPage />, { wrapper });
    fireEvent.change(screen.getByLabelText(t('admin.users.rules.nameLabel')), {
      target: { value: 'VIP' },
    });
    await pick(t('admin.users.rules.toCategory'), 'VIP');
    addCondition();
    fireEvent.change(screen.getByLabelText(t('common.value')), {
      target: { value: '500' },
    });
    fireEvent.click(screen.getByRole('button', { name: t('common.create') }));
    await waitFor(() => expect(m.insertCategoryRules).toHaveBeenCalled());
    const [{ data }] = m.insertCategoryRules.mock.calls[0] as [
      { data: Array<Record<string, unknown>> },
    ];
    expect(data[0]).toMatchObject({
      name: 'VIP',
      fromCategoryId: null,
      toCategoryId: CATEGORY_ID.vip,
      conditions: {
        type: 'all',
        rules: [{ field: 'total_purchases', operator: '>=', value: '500' }],
      },
    });
    expect(typeof data[0]!.id).toBe('string');
  });

  it('правило без умов не зберігається (порожній список невалідний)', async () => {
    render(<CategoryRuleEditPage />, { wrapper });
    fireEvent.change(screen.getByLabelText(t('admin.users.rules.nameLabel')), {
      target: { value: 'VIP' },
    });
    await pick(t('admin.users.rules.toCategory'), 'VIP');
    fireEvent.click(screen.getByRole('button', { name: t('common.create') }));
    await screen.findByText(
      t('admin.customerCategories.rules.conditionsInvalid'),
    );
    expect(m.insertCategoryRules).not.toHaveBeenCalled();
  });
});
