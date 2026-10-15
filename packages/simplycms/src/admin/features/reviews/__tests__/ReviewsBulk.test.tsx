// @vitest-environment jsdom
/** Масова модерація (Task 9, Е6д): вибір, ids/status, інвалідація, 409. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createTranslator } from 'simplycms/i18n';
import { ENTITY } from 'simplycms/contracts/entities';
import ReviewsPage from '../list/ReviewsPage';
import {
  mocks,
  page,
  renderWithClient,
  row,
  stubDom,
  ui,
} from './render-support';

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
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

const t = createTranslator('uk', 'uk');
const rows = [row(1), row(2), row(3)];

beforeEach(() => {
  stubDom();
  Object.values(mocks).forEach((m) => m.mockReset());
  ui.toastError.mockReset();
  mocks.listReviews.mockResolvedValue(page(rows));
  mocks.countPendingReviews.mockResolvedValue({ pending: 3 });
});
afterEach(cleanup);

async function selectTwo() {
  const user = userEvent.setup();
  const view = renderWithClient(<ReviewsPage />);
  await screen.findByText('Товар 1');
  const boxes = screen.getAllByRole('checkbox', {
    name: t('admin.reviews.selectRow'),
  });
  await user.click(boxes[0]!);
  await user.click(boxes[1]!);
  return { user, ...view };
}

describe('ReviewsBulkBar', () => {
  it('«Схвалити вибрані» шле { items з updatedAt, status } і інвалідує [product_reviews]', async () => {
    mocks.setReviewsStatus.mockResolvedValue({ updated: 2 });
    const { user, client } = await selectTwo();
    const spy = vi.spyOn(client, 'invalidateQueries');
    await user.click(
      screen.getByRole('button', { name: t('admin.reviews.approveSelected') }),
    );
    await waitFor(() =>
      expect(mocks.setReviewsStatus).toHaveBeenCalledWith({
        data: {
          items: [rows[0]!, rows[1]!].map((r) => ({
            id: r.id,
            updatedAt: r.updatedAt.toISOString(),
          })),
          status: 'approved',
        },
      }),
    );
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({ queryKey: [ENTITY.productReviews] }),
    );
    await waitFor(() =>
      expect(
        screen.queryByText(t('admin.reviews.selectedCount', { count: 2 })),
      ).toBeNull(),
    );
  });

  it('«Відхилити вибрані» шле status: rejected', async () => {
    mocks.setReviewsStatus.mockResolvedValue({ updated: 2 });
    const { user } = await selectTwo();
    await user.click(
      screen.getByRole('button', { name: t('admin.reviews.rejectSelected') }),
    );
    await waitFor(() =>
      expect(mocks.setReviewsStatus.mock.lastCall![0].data.status).toBe(
        'rejected',
      ),
    );
  });

  it('409 review_not_found → тост, інвалідація, вибір знято', async () => {
    mocks.setReviewsStatus.mockRejectedValue({
      name: 'AdminConflictError',
      kind: 'state',
      constraint: 'review_not_found',
    });
    const { user, client } = await selectTwo();
    const spy = vi.spyOn(client, 'invalidateQueries');
    await user.click(
      screen.getByRole('button', { name: t('admin.reviews.approveSelected') }),
    );
    await waitFor(() =>
      expect(ui.toastError).toHaveBeenCalledWith(
        t('admin.errors.reviewNotFound'),
      ),
    );
    expect(spy).toHaveBeenCalledWith({ queryKey: [ENTITY.productReviews] });
    await waitFor(() =>
      expect(
        screen.queryByText(t('admin.reviews.selectedCount', { count: 2 })),
      ).toBeNull(),
    );
  });

  it('🔴 409 review_changed → тост admin.reviews.changed, перечитування, вибір знято', async () => {
    mocks.setReviewsStatus.mockRejectedValue({
      name: 'AdminConflictError',
      kind: 'state',
      constraint: 'review_changed',
    });
    const { user, client } = await selectTwo();
    const spy = vi.spyOn(client, 'invalidateQueries');
    await user.click(
      screen.getByRole('button', { name: t('admin.reviews.approveSelected') }),
    );
    await waitFor(() =>
      expect(ui.toastError).toHaveBeenCalledWith(t('admin.reviews.changed')),
    );
    expect(spy).toHaveBeenCalledWith({ queryKey: [ENTITY.productReviews] });
    await waitFor(() =>
      expect(
        screen.queryByText(t('admin.reviews.selectedCount', { count: 2 })),
      ).toBeNull(),
    );
  });

  it('«вибрати всі завантажені» вибирає всі рядки', async () => {
    const user = userEvent.setup();
    renderWithClient(<ReviewsPage />);
    await screen.findByText('Товар 1');
    await user.click(
      screen.getByRole('checkbox', { name: t('admin.reviews.selectAll') }),
    );
    expect(
      screen.getByText(t('admin.reviews.selectedCount', { count: 3 })),
    ).toBeTruthy();
  });
});
