// @vitest-environment jsdom
/** Картка відгуку (Task 9, Е6д): фото-референси, примітка, статуси, видалення. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createTranslator } from 'simplycms/i18n';
import { ENTITY } from 'simplycms/contracts/entities';
import ReviewCardPage from '../card/ReviewCardPage';
import {
  REVIEW_ID,
  card,
  mocks,
  renderWithClient,
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
vi.mock('@tanstack/react-router', async () => {
  const { ui } = await import('./mocks');
  return {
    useNavigate: () => ui.navigate,
    useParams: () => ({ reviewId: 'r0000000-0000-4000-8000-000000000001' }),
    Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  };
});

const t = createTranslator('uk');

beforeEach(() => {
  stubDom();
  Object.values(mocks).forEach((m) => m.mockReset());
  ui.navigate.mockClear();
  mocks.getReviewCard.mockResolvedValue(card());
});
afterEach(cleanup);

describe('ReviewCardPage', () => {
  it('фото резолвиться з референсу: src="/media/<ref>", клік — оригінал', async () => {
    renderWithClient(<ReviewCardPage />);
    const img = await screen.findByRole('img', {
      name: t('admin.reviews.photo', { index: 1 }),
    });
    expect(img.getAttribute('src')).toBe('/media/review/r1/a.jpg');
    expect(img.closest('a')?.getAttribute('href')).toBe(
      '/media/review/r1/a.jpg',
    );
    expect(screen.getByText('Чудовий товар')).toBeTruthy();
    expect(screen.getByText(t('admin.reviews.internalNote'))).toBeTruthy();
  });

  it('«Відхилити» з приміткою шле adminComment і інвалідує [product_reviews]', async () => {
    mocks.setReviewsStatus.mockResolvedValue({ updated: 1 });
    const user = userEvent.setup();
    const { client } = renderWithClient(<ReviewCardPage />);
    const spy = vi.spyOn(client, 'invalidateQueries');
    await user.type(
      await screen.findByLabelText(t('admin.reviews.internalNote')),
      'спам',
    );
    await user.click(
      screen.getByRole('button', { name: t('admin.reviews.reject') }),
    );
    await waitFor(() =>
      expect(mocks.setReviewsStatus).toHaveBeenCalledWith({
        data: {
          items: [{ id: REVIEW_ID, updatedAt: '2026-10-02T00:00:00.000Z' }],
          status: 'rejected',
          adminComment: 'спам',
        },
      }),
    );
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({ queryKey: [ENTITY.productReviews] }),
    );
  });

  it('видалення — лише після підтвердження, далі перехід на список', async () => {
    mocks.deleteReview.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithClient(<ReviewCardPage />);
    await user.click(
      await screen.findByRole('button', { name: t('common.delete') }),
    );
    expect(mocks.deleteReview).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toBeTruthy();
    const confirm = Array.from(dialog.querySelectorAll('button')).find(
      (b) => b.textContent === t('common.delete'),
    )!;
    await user.click(confirm);
    await waitFor(() =>
      expect(mocks.deleteReview).toHaveBeenCalledWith({
        data: { id: REVIEW_ID },
      }),
    );
    await waitFor(() => expect(ui.navigate).toHaveBeenCalled());
  });

  it('схвалений відгук показує «Повернути на модерацію»', async () => {
    mocks.getReviewCard.mockResolvedValue(card({ status: 'approved' }));
    renderWithClient(<ReviewCardPage />);
    expect(
      await screen.findByRole('button', {
        name: t('admin.reviews.backToPending'),
      }),
    ).toBeTruthy();
  });
});
