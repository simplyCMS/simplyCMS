// К3-Е6д, Task 6: покупець через РЕАЛЬНИЙ `resolveGrant` отримує AuthzError на
// кожній операції модерації; БД і файли незмінні.
import { describe, expect, it, vi } from 'vitest';
import { AuthzError, requireGrant } from 'simplycms/auth';
import {
  countPendingReviewsOp,
  deleteReviewOp,
  getReviewCardOp,
  listReviewsOp,
  setReviewsStatusOp,
} from 'simplycms/admin-server/impl';
import { asCustomer } from './fixtures/admin-system';
import { useReviewsDb } from './fixtures/reviews';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: null, roles: ['admin'] },
    scope: 'any',
  })),
}));

describe('admin: покупець не модерує відгуки (Е6д-7)', () => {
  const d = useReviewsDb('simplycms_e6d_rv_authz');
  const { f } = d;

  it('кожна з п’яти операцій → AuthzError review.moderate; БД і файли незмінні', async () => {
    const id = await d.seedReview();
    const refs = await d.seedPhotos(id, 1);
    const snap = () =>
      f.rows('select * from public.product_reviews order by id');
    const before = await snap();
    const ops: Array<[string, () => Promise<unknown>]> = [
      ['listReviews', () => listReviewsOp({ data: {} })],
      ['countPendingReviews', () => countPendingReviewsOp()],
      ['getReviewCard', () => getReviewCardOp({ data: { id } })],
      [
        'setReviewsStatus',
        () =>
          setReviewsStatusOp({
            data: {
              items: [{ id, updatedAt: '2026-01-01T00:00:00.000Z' }],
              status: 'approved',
            },
          }),
      ],
      ['deleteReview', () => deleteReviewOp({ data: { id } })],
    ];
    for (const [name, run] of ops) {
      asCustomer();
      await expect(run(), name).rejects.toThrow(AuthzError);
      expect(vi.mocked(requireGrant), name).toHaveBeenLastCalledWith(
        'review.moderate',
      );
    }
    expect(await snap()).toEqual(before);
    expect(d.hasFile(refs[0]!)).toBe(true);
    expect(await d.mediaRows(refs[0]!)).toHaveLength(1);
  });
});
