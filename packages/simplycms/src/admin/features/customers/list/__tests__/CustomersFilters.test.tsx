// @vitest-environment jsdom
/** Фільтри списку покупців: кожен контрол — аргумент serverFn і скинутий курсор. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createTranslator } from 'simplycms/i18n';
import { CAT, mocks, page, renderPage, row, stubDom } from './render-support';

vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock((await import('./mocks')).mocks),
);
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

const t = createTranslator('uk');
const lastArg = () => mocks.listCustomers.mock.lastCall![0].data;
const CURSOR = { createdAt: new Date('2026-10-01T00:00:00Z'), id: 'x' };

beforeEach(() => {
  stubDom();
  mocks.listCustomers.mockReset();
  mocks.listCustomers.mockImplementation(async ({ data }) =>
    page([row(1)], data.cursor ? null : CURSOR),
  );
  mocks.listUserCategories.mockResolvedValue([CAT]);
});
afterEach(cleanup);

/** Довантажує другу сторінку, щоб було що скидати зміною фільтра. */
async function withSecondPage() {
  const user = userEvent.setup();
  renderPage();
  await user.click(
    await screen.findByRole('button', { name: t('admin.users.loadMore') }),
  );
  await waitFor(() => expect(mocks.listCustomers).toHaveBeenCalledTimes(2));
  expect(lastArg().cursor).toEqual(CURSOR);
  return user;
}

describe('CustomersFilters', () => {
  it('пошук: 1 символ → search відсутній; 2 → передано; курсор скинуто', async () => {
    const user = await withSecondPage();
    const input = screen.getByPlaceholderText(
      t('admin.users.searchPlaceholder'),
    );
    await user.type(input, 'a');
    await new Promise((r) => setTimeout(r, 450));
    expect(mocks.listCustomers.mock.calls.every(([a]) => !a.data.search)).toBe(
      true,
    );
    await user.type(input, 'b');
    await waitFor(() => expect(lastArg().search).toBe('ab'), { timeout: 2000 });
    expect(lastArg().cursor).toBeUndefined();
  });

  it('категорія → categoryId, курсор скинуто', async () => {
    const user = await withSecondPage();
    await user.click(screen.getByLabelText(t('admin.users.category')));
    await user.click(await screen.findByRole('option', { name: 'Опт' }));
    await waitFor(() => expect(lastArg().categoryId).toBe(CAT.id));
    expect(lastArg().cursor).toBeUndefined();
  });

  it('роль → role, курсор скинуто', async () => {
    const user = await withSecondPage();
    await user.click(screen.getByLabelText(t('admin.users.role')));
    await user.click(
      await screen.findByRole('option', { name: t('admin.users.admins') }),
    );
    await waitFor(() => expect(lastArg().role).toBe('admin'));
    expect(lastArg().cursor).toBeUndefined();
  });

  it('«заблоковані» → banned: true, курсор скинуто', async () => {
    const user = await withSecondPage();
    await user.click(screen.getByLabelText(t('admin.users.onlyBanned')));
    await waitFor(() => expect(lastArg().banned).toBe(true));
    expect(lastArg().cursor).toBeUndefined();
  });
});
