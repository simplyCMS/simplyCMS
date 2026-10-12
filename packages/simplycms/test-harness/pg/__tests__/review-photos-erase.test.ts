// К3-Е6д, Task 7 (Е6д-9, Е6д-14, Е6д-16): покупець видаляє власний відгук із
// фото — рядки `media` у транзакції, файли ПІСЛЯ COMMIT; чуже не стирається.
import { sql } from 'drizzle-orm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { withActor } from 'simplycms/db';
import { deleteMyProductReview } from 'simplycms/core/lib/review-form';
import {
  deleteProductReview,
  submitReviewWithImages,
  withCustomerDb,
} from 'simplycms/storefront/loaders';
import { png, useReviewPhotosDb } from './fixtures/review-photos';

const session = vi.hoisted(() => ({ userId: '' }));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    const builder = {
      validator: () => builder,
      handler: (fn: unknown) => fn,
    };
    return builder;
  },
}));
vi.mock('@tanstack/react-start/server', () => ({
  getRequest: () => ({ headers: new Headers() }),
  setResponseStatus: vi.fn(),
}));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  readSessionSubject: async () => ({ userId: session.userId }),
}));

const delMine = (userId: string, reviewId: string) => {
  session.userId = userId;
  return (
    deleteMyProductReview as unknown as (a: {
      data: { reviewId: string };
    }) => Promise<boolean>
  )({ data: { reviewId } });
};

describe('фото у відгуку: видалення покупцем (Е6д-9, Е6д-14)', () => {
  const d = useReviewPhotosDb('simplycms_e6d_rv_erase');
  const { f } = d;
  const seeded = async () => {
    const userId = await d.seedUser('Автор');
    const { id } = await submitReviewWithImages(
      userId,
      { productId: f.ids.panel, rating: 5, title: null, content: null },
      [png(1), png(2)],
    );
    return { userId, id, refs: (await d.reviewRow(id))!.images! };
  };
  const intact = async (id: string, refs: readonly string[]) => {
    expect(await d.exists(id)).toBe(true);
    expect(await d.reviewMedia(id)).toHaveLength(refs.length);
    expect(refs.every((r) => d.hasFile(r))).toBe(true);
  };

  afterEach(() => vi.restoreAllMocks());

  it('свій відгук → true; рядка, файлів і media немає', async () => {
    const { userId, id, refs } = await seeded();
    expect(await delMine(userId, id)).toBe(true);
    expect(await d.exists(id)).toBe(false);
    expect(await d.reviewMedia(id)).toEqual([]);
    expect(refs.some((r) => d.hasFile(r))).toBe(false);
  });

  it('🔴 чужий (схвалений, видимий) відгук → false, файли й media цілі', async () => {
    const { id, refs } = await seeded();
    await f.rows(
      `update public.product_reviews set status = 'approved' where id = $1`,
      [id],
    );
    const other = await d.seedUser('Інший');
    await expect(
      withCustomerDb(other, (db, op) => deleteProductReview(db, op, other, id)),
    ).resolves.toEqual({ deleted: false, discard: [] });
    expect(await delMine(other, id)).toBe(false);
    await intact(id, refs);
  });

  it('транзакція впала ПІСЛЯ ядра → відгук, media і файли на місці, driver.delete не викликано', async () => {
    const { userId, id, refs } = await seeded();
    const spy = vi.spyOn(d.getMediaDriver(), 'delete');
    await expect(
      withCustomerDb(userId, async (db, op) => {
        await deleteProductReview(db, op, userId, id);
        throw new Error('after core');
      }),
    ).rejects.toThrow('after core');
    expect(spy).not.toHaveBeenCalled();
    await intact(id, refs);
  });

  it('🔴 COMMIT впав → відгук, media і файли на місці, driver.delete не викликано', async () => {
    const { userId, id, refs } = await seeded();
    const spy = vi.spyOn(d.getMediaDriver(), 'delete');
    const unblock = await d.blockCommit('product_reviews');
    try {
      await expect(delMine(userId, id)).rejects.toThrow();
    } finally {
      await unblock();
    }
    expect(spy).not.toHaveBeenCalled();
    await intact(id, refs);
  });

  it('driver.delete падає на другому файлі → відгук і media видалено, один файл — орфан', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { userId, id, refs } = await seeded();
    const real = d.getMediaDriver();
    const del = real.delete.bind(real);
    let calls = 0;
    vi.spyOn(real, 'delete').mockImplementation(async (ref: string) => {
      if (++calls === 2) throw new Error('disk');
      return del(ref);
    });
    expect(await delMine(userId, id)).toBe(true);
    expect(await d.exists(id)).toBe(false);
    expect(await d.reviewMedia(id)).toEqual([]);
    expect(refs.filter((r) => d.hasFile(r))).toHaveLength(1);
  });

  it('🔴 чужий ключ (аватар іншого покупця) у своєму відгуку → аватар і media цілі (Е6д-16)', async () => {
    const { userId, id, refs } = await seeded();
    const b = await d.seedBuyer({ avatar: true });
    // `app_user` колонку `images` писати не може (Task 5) — лише адмін.
    await withActor({ role: 'app_admin' }, (db) =>
      db.execute(
        sql`update public.product_reviews set images = ${JSON.stringify([...refs, b.avatar])}::jsonb where id = ${id}`,
      ),
    );
    expect(await delMine(userId, id)).toBe(true);
    expect(refs.some((r) => d.hasFile(r))).toBe(false);
    expect(d.hasFile(b.avatar!)).toBe(true);
    expect(await d.mediaRows(b.avatar!)).toHaveLength(1);
  });
});
