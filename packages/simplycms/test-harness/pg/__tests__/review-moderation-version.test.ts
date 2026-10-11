// К3-Е6д, Task 9 (Е6д-23): модерація проти ПОБАЧЕНОЇ версії відгуку —
// `updatedAt` з картки, мілісекунди проти мікросекунд БД, атомарність пакета
// і гонка з правкою покупця.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getReviewCardOp,
  setReviewsStatusOp,
} from 'simplycms/admin-server/impl';
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

const CHANGED = conflict('state', 'review_changed');

describe('admin: модерація проти версії відгуку (Е6д-23)', () => {
  const d = useReviewsDb('simplycms_e6d_rv_ver');
  const { f } = d;
  const set = (
    items: { id: string; updatedAt: string }[],
    status = 'approved',
  ) => setReviewsStatusOp({ data: { items, status } as never });
  // Рядок із ненульовими мікросекундами: `now()` у БД, не JS-дата.
  const seedMicro = async () => {
    const id = await d.seedReview();
    await f.rows(
      `update public.product_reviews set updated_at = '2026-03-04 05:06:07.123456+00' where id = $1`,
      [id],
    );
    return id;
  };

  afterEach(() => vi.restoreAllMocks());

  it('актуальна версія → схвалено', async () => {
    const id = await d.seedReview();
    expect(await set(await d.items([id]))).toEqual({ updated: 1 });
    expect(await d.status(id)).toBe('approved');
  });

  it('🔴 пакет із двох, одна застаріла → 409 review_changed, обидва pending', async () => {
    const [a, b] = [await d.seedReview(), await d.seedReview()] as [
      string,
      string,
    ];
    const items = await d.items([a, b]);
    await f.rows(
      `update public.product_reviews set updated_at = updated_at + interval '5 seconds' where id = $1`,
      [b],
    );
    await expect(set(items)).rejects.toMatchObject(CHANGED);
    expect(await d.status(a)).toBe('pending');
    expect(await d.status(b)).toBe('pending');
  });

  it('🔴 мікросекунди: updatedAt з картки → схвалення успішне', async () => {
    const id = await seedMicro();
    const card = await getReviewCardOp({ data: { id } });
    const updatedAt = card!.updatedAt.toISOString();
    expect(updatedAt).toBe('2026-03-04T05:06:07.123Z');
    expect(await set([{ id, updatedAt }])).toEqual({ updated: 1 });
    expect(await d.status(id)).toBe('approved');
  });

  it('🔴 гонка: правка покупця між читанням модератора і схваленням → 409', async () => {
    const id = await d.seedReview({ status: 'approved' });
    const items = await d.items([id]);
    // Покупець уже взяв лок рядка й правитиме: модератор чекає, а після COMMIT
    // бачить нову версію під власним FOR UPDATE.
    const rival = await holdRowLock(
      f.db.url,
      `update public.product_reviews set status = 'pending', updated_at = now() + interval '1 second' where id = $1 returning id`,
      [id],
    );
    try {
      const op = set(items);
      op.catch(() => {});
      expect(await stillPending(op, 300)).toBe(true);
      await rival.release();
      await expect(op).rejects.toMatchObject(CHANGED);
    } finally {
      await rival.cleanup();
    }
    expect(await d.status(id)).toBe('pending');
  });
});
