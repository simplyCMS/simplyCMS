// К3-Е6д, Task 6: модерація — статус (Е6д-7) і видалення з двофазним
// стиранням фото (Е6д-14, Е6д-16). Негативна авторизація — `-authz`.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setReviewsStatusOp } from 'simplycms/admin-server/impl';
import {
  loadProductRatings,
  withStorefrontDb,
} from 'simplycms/storefront/loaders';
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

const NOT_FOUND = conflict('state', 'review_not_found');

describe('admin: модерація відгуків (Е6д-7, Е6д-14, Е6д-16)', () => {
  const d = useReviewsDb('simplycms_e6d_rv_mod');
  const { f } = d;
  const set = (ids: string[], status: string, extra: object = {}) =>
    setReviewsStatusOp({ data: { ids, status, ...extra } as never });
  const comment = async (id: string) =>
    (
      await f.one<{ c: string | null }>(
        `select admin_comment as c from public.product_reviews where id = $1`,
        [id],
      )
    ).c;

  afterEach(() => vi.restoreAllMocks());

  it('одиночне схвалення з коментарем; без ключа коментар не змінюється; порожній → NULL', async () => {
    const id = await d.seedReview({ adminComment: 'старий' });
    expect(await set([id], 'approved', { adminComment: '  Ок  ' })).toEqual({
      updated: 1,
    });
    expect(await d.status(id)).toBe('approved');
    expect(await comment(id)).toBe('Ок');
    await set([id], 'rejected');
    expect(await comment(id)).toBe('Ок');
    await set([id], 'pending', { adminComment: '   ' });
    expect(await comment(id)).toBeNull();
  });

  it('масове відхилення 3 → updated: 3; rejected → pending дозволено', async () => {
    const ids = [
      await d.seedReview(),
      await d.seedReview(),
      await d.seedReview(),
    ];
    expect(await set(ids, 'rejected')).toEqual({ updated: 3 });
    expect(await set([ids[0]!], 'pending')).toEqual({ updated: 1 });
    expect(await d.status(ids[0]!)).toBe('pending');
  });

  it('🔴 атомарність: 3 існуючі + 1 неіснуючий → 409, статуси старі', async () => {
    const ids = [
      await d.seedReview(),
      await d.seedReview(),
      await d.seedReview(),
    ];
    await expect(
      set([...ids, crypto.randomUUID()], 'approved'),
    ).rejects.toMatchObject(NOT_FOUND);
    for (const id of ids) expect(await d.status(id)).toBe('pending');
  });

  it('дублі в ids → 400; 101 id → 400', async () => {
    const id = await d.seedReview();
    await expect(set([id, id], 'approved')).rejects.toMatchObject({
      name: 'ValidationError',
    });
    const many = Array.from({ length: 101 }, () => crypto.randomUUID());
    await expect(set(many, 'approved')).rejects.toMatchObject({
      name: 'ValidationError',
    });
  });

  it('рейтинг вітрини змінюється після схвалення ядром', async () => {
    const product = f.ids.battery;
    const rating = async () =>
      (await withStorefrontDb((db) => loadProductRatings(db, [product])))[
        product
      ];
    const before = await rating();
    const id = await d.seedReview({ productId: product, rating: 5 });
    expect(await rating()).toEqual(before);
    await set([id], 'approved');
    expect((await rating())?.reviewCount).toBe((before?.reviewCount ?? 0) + 1);
  });
});
