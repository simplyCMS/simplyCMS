// К3-Е6д, фінальне рев'ю (м1): гонка масової зміни статусу з видаленням
// відгуку іншим адміном. Детерміновано: незакомічений DELETE тримає рядковий
// лок на ОКРЕМОМУ зʼєднанні, а не випадкова перемога гонки.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setReviewsStatusOp } from 'simplycms/admin-server/impl';
import { holdRowLock, stillPending } from './fixtures/advisory-lock';
import { conflict } from './fixtures/admin-shipping';
import { useReviewsDb } from './fixtures/reviews';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: null, roles: ['admin'] },
    scope: 'any',
  })),
}));

describe('admin: зміна статусу відгуків — гонка з видаленням (Е6д-7)', () => {
  const d = useReviewsDb('simplycms_e6d_rv_locks');
  const { f } = d;

  afterEach(() => vi.restoreAllMocks());

  // 🔴 Без `FOR UPDATE` у `setReviewsStatus` перевірка кількості бачить ще не
  // закомічений видалений рядок (3 з 3), UPDATE чекає на його лок, а після
  // COMMIT конкурента мовчки оновлює 2 з 3 — частковий запис без 409.
  it('інший адмін видаляє один із пакета → 409 review_not_found, решта статусів старі', async () => {
    const ids = [
      await d.seedReview(),
      await d.seedReview(),
      await d.seedReview(),
    ];
    const gone = ids[2]!;
    const rival = await holdRowLock(
      f.db.url,
      'delete from public.product_reviews where id = $1 returning id',
      [gone],
    );
    try {
      const op = setReviewsStatusOp({
        data: { ids, status: 'approved' },
      });
      op.catch(() => {});
      expect(await stillPending(op, 300)).toBe(true);
      await rival.release();
      await expect(op).rejects.toMatchObject(
        conflict('state', 'review_not_found'),
      );
    } finally {
      await rival.cleanup();
    }
    expect(await d.exists(gone)).toBe(false);
    for (const id of ids.slice(0, 2))
      expect(await d.status(id)).toBe('pending');
  });
});
