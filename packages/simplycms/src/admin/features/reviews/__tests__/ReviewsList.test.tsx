// @vitest-environment jsdom
/** Список модерації відгуків (Task 9, Е6д): «Показати ще», фільтр, бейдж, автор. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createTranslator } from 'simplycms/i18n';
import ReviewsPage from '../list/ReviewsPage';
import { mocks, page, renderWithClient, row, stubDom } from './render-support';

vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock((await import('./mocks')).mocks),
);
vi.mock('sonner', async () => {
  const { ui } = await import('./mocks');
  return { toast: { error: ui.toastError, success: ui.toastSuccess } };
});
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    params,
    children,
  }: {
    to: string;
    params?: Record<string, string>;
    children: React.ReactNode;
  }) => (
    <a href={to.replace(/\$(\w+)/g, (_, k) => params?.[k] ?? '')}>{children}</a>
  ),
}));

const t = createTranslator('uk');
const CURSOR = { createdAt: new Date('2026-10-01T00:00:00Z'), id: 'x' };
const lastArg = () => mocks.listReviews.mock.lastCall![0].data;

beforeEach(() => {
  stubDom();
  mocks.listReviews.mockReset();
  mocks.countPendingReviews.mockReset();
  mocks.countPendingReviews.mockResolvedValue({ pending: 7 });
  mocks.listReviews.mockImplementation(async ({ data }) =>
    page([row(data.cursor ? 2 : 1)], data.cursor ? null : CURSOR),
  );
});
afterEach(cleanup);

describe('ReviewsPage', () => {
  it('«Показати ще» шле cursor; бейдж — число countPendingReviews', async () => {
    const user = userEvent.setup();
    renderWithClient(<ReviewsPage />);
    expect(await screen.findByText('Товар 1')).toBeTruthy();
    expect(
      await screen.findByText(t('admin.reviews.pending', { count: 7 })),
    ).toBeTruthy();
    await user.click(
      screen.getByRole('button', { name: t('admin.reviews.loadMore') }),
    );
    await waitFor(() => expect(mocks.listReviews).toHaveBeenCalledTimes(2));
    expect(lastArg().cursor).toEqual(CURSOR);
    expect(await screen.findByText('Товар 2')).toBeTruthy();
  });

  it('зміна фільтра скидає курсор і вибір; бейдж не залежить від фільтра', async () => {
    const user = userEvent.setup();
    renderWithClient(<ReviewsPage />);
    await screen.findByText('Товар 1');
    await user.click(
      screen.getByRole('checkbox', { name: t('admin.reviews.selectRow') }),
    );
    expect(
      screen.getByText(t('admin.reviews.selectedCount', { count: 1 })),
    ).toBeTruthy();
    await user.click(screen.getByRole('combobox'));
    await user.click(
      await screen.findByRole('option', {
        name: t('admin.reviews.approvedPlural'),
      }),
    );
    await waitFor(() => expect(lastArg().status).toBe('approved'));
    expect(lastArg().cursor).toBeUndefined();
    await screen.findByText('Товар 1');
    expect(
      screen.queryByText(t('admin.reviews.selectedCount', { count: 1 })),
    ).toBeNull();
    expect(mocks.countPendingReviews).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText(t('admin.reviews.pending', { count: 7 })),
    ).toBeTruthy();
  });

  it('userId: null → «Колишній покупець» без посилання', async () => {
    mocks.listReviews.mockResolvedValue(
      page([row(1, { userId: null, authorName: null, authorEmail: null })]),
    );
    renderWithClient(<ReviewsPage />);
    expect(
      await screen.findByText(t('admin.reviews.formerCustomer')),
    ).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Автор/ })).toBeNull();
  });

  it('автор з userId → посилання на /admin/users/$userId', async () => {
    mocks.listReviews.mockResolvedValue(page([row(1)]));
    renderWithClient(<ReviewsPage />);
    const link = await screen.findByRole('link', { name: 'Автор 1' });
    expect(link.getAttribute('href')).toBe(
      '/admin/users/u0000000-0000-4000-8000-000000000001',
    );
  });
});
