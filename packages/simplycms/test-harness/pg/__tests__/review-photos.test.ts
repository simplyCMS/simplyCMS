// К3-Е6д, Task 7 (§4, Д-3, Е6д-5, Е6д-17, Review Focus 2): подача відгуку з
// фото одним актом — файли, рядки `media` і відгук або разом, або нічого.
// Межа serverFn (FormData) — `review-photos-form`, стирання — `-erase`.
import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { REVIEW_SUBMIT_ERROR } from 'simplycms/contracts';
import {
  loadProductReviews,
  submitReviewWithImages,
  withCustomerDb,
  withStorefrontDb,
} from 'simplycms/storefront/loaders';
import { stillPending } from './fixtures/advisory-lock';
import { png, useReviewPhotosDb } from './fixtures/review-photos';

describe('фото у відгуку: подача (Е6д-5, Review Focus 2)', () => {
  const d = useReviewPhotosDb('simplycms_e6d_rv_photos');
  const { f } = d;
  const input = () => ({
    productId: f.ids.panel,
    rating: 5,
    title: 'Заголовок',
    content: '<p>Текст</p>',
  });
  const visibleTo = (userId: string | null, id: string) =>
    (userId
      ? withCustomerDb(userId, (db) => loadProductReviews(db, f.ids.panel))
      : withStorefrontDb((db) => loadProductReviews(db, f.ids.panel))
    ).then((rows) => rows.find((r) => r.id === id));

  it('2 PNG → pending, 2 референси, файли й media власника; автор бачить одразу, гість — після схвалення', async () => {
    const userId = await d.seedUser('Автор');
    const other = await d.seedUser('Інший');
    const before = d.diskKeys();
    const { id } = await submitReviewWithImages(userId, input(), [
      png(1),
      png(2),
    ]);
    const row = (await d.reviewRow(id))!;
    expect(row).toMatchObject({ user_id: userId, status: 'pending' });
    const refs = row.images!;
    expect(refs).toHaveLength(2);
    expect(d.diskKeys()).toEqual([...before, ...refs].sort());
    const media = await d.reviewMedia(id);
    expect(media.map((m) => m.storage_key)).toEqual([...refs].sort());
    expect(media.every((m) => m.uploaded_by === userId)).toBe(true);

    // Е6д-17: автор бачить свій pending разом із фото; гість та інший — ні.
    const urls = refs.map((r) => `/media/${r}`);
    expect((await visibleTo(userId, id))?.images).toEqual(urls);
    expect(await visibleTo(null, id)).toBeUndefined();
    expect(await visibleTo(other, id)).toBeUndefined();

    await f.rows(
      `update public.product_reviews set status = 'approved' where id = $1`,
      [id],
    );
    expect((await visibleTo(null, id))?.images).toEqual(urls);
  });

  it('🔴 put другого файлу кидає → ні файлів, ні media, ні відгуку', async () => {
    const userId = await d.seedUser('Автор');
    const before = d.diskKeys();
    const mediaBefore = await d.mediaCount();
    const real = d.getMediaDriver();
    let puts = 0;
    const driver = {
      ...real,
      put: async (key: string, bytes: Uint8Array) => {
        if (++puts === 2) throw new Error('disk');
        return real.put(key, bytes);
      },
    };
    await expect(
      submitReviewWithImages(userId, input(), [png(1), png(2)], { driver }),
    ).rejects.toThrow('disk');
    expect(puts).toBe(2);
    expect(d.diskKeys()).toEqual(before);
    expect(await d.mediaCount()).toBe(mediaBefore);
    expect(await d.count('product_reviews', 'user_id = $1', [userId])).toBe(0);
  });

  it('повторний відгук → already-submitted ДО запису: диск і media незмінні', async () => {
    const userId = await d.seedUser('Автор');
    await d.seedReview({ userId });
    const before = d.diskKeys();
    const mediaBefore = await d.mediaCount();
    await expect(
      submitReviewWithImages(userId, input(), [png(1)]),
    ).rejects.toThrow(REVIEW_SUBMIT_ERROR.alreadySubmitted);
    expect(d.diskKeys()).toEqual(before);
    expect(await d.mediaCount()).toBe(mediaBefore);
  });

  it('гонка: незакомічений відгук іншого зʼєднання → 23505 → already-submitted, орфанів немає', async () => {
    const userId = await d.seedUser('Автор');
    const before = d.diskKeys();
    const mediaBefore = await d.mediaCount();
    const client = new pg.Client({ connectionString: f.db.url });
    await client.connect();
    try {
      await client.query('begin');
      await client.query(
        `insert into public.product_reviews (id, product_id, user_id, rating, status)
         values (gen_random_uuid(), $1, $2, 5, 'pending')`,
        [f.ids.panel, userId],
      );
      const op = submitReviewWithImages(userId, input(), [png(1), png(2)]);
      op.catch(() => {});
      // Перевірка «вже є» чужої незакоміченої вставки не бачить — файли вже
      // опубліковано, вставка чекає на унікальний індекс.
      expect(await stillPending(op, 400)).toBe(true);
      await client.query('commit');
      await expect(op).rejects.toThrow(REVIEW_SUBMIT_ERROR.alreadySubmitted);
    } finally {
      await client.end();
    }
    expect(d.diskKeys()).toEqual(before);
    expect(await d.mediaCount()).toBe(mediaBefore);
  });
});
