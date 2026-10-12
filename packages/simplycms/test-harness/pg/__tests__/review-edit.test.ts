// К3-Е6д, Task 9 (Е6д-23): покупець редагує власний відгук — повернення на
// модерацію, фото (лишити/прибрати/додати), двофазне стирання, чужий відгук.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { REVIEW_SUBMIT_ERROR } from 'simplycms/contracts';
import { MAX_REVIEW_IMAGES } from 'simplycms/domain/media';
import {
  loadProductReviews,
  submitReviewWithImages,
  withCustomerDb,
  withStorefrontDb,
  updateProductReviewWithImages,
} from 'simplycms/storefront/loaders';
import { png, useReviewPhotosDb } from './fixtures/review-photos';

describe('редагування відгуку покупцем (Е6д-23)', () => {
  const d = useReviewPhotosDb('simplycms_e6d_rv_edit');
  const { f } = d;
  const seeded = async (n = 2, status = 'approved') => {
    const userId = await d.seedUser('Автор');
    const { id } = await submitReviewWithImages(
      userId,
      { productId: f.ids.panel, rating: 5, title: 'Старий', content: null },
      Array.from({ length: n }, (_, i) => png(i + 1)),
    );
    await f.rows(
      `update public.product_reviews set status = $2 where id = $1`,
      [id, status],
    );
    return { userId, id, refs: (await d.reviewRow(id))!.images! };
  };
  const edit = (
    userId: string,
    id: string,
    o: {
      keep?: string[];
      files?: ReturnType<typeof png>[];
      content?: string;
    } = {},
    opts = {},
  ) =>
    updateProductReviewWithImages(
      userId,
      {
        id,
        rating: 3,
        title: 'Новий',
        content: o.content ?? null,
        keep: o.keep ?? [],
        files: o.files ?? [],
      },
      opts,
    );

  afterEach(() => vi.restoreAllMocks());

  it('approved → pending, текст санітизовано, оцінка й заголовок оновлені', async () => {
    const { userId, id, refs } = await seeded(1);
    await edit(userId, id, {
      keep: refs,
      content: '<p>Ок</p><script>alert(1)</script>',
    });
    const row = (await d.reviewRow(id))!;
    expect(row).toMatchObject({ status: 'pending', rating: 3, title: 'Новий' });
    const [{ content }] = await f.rows<{ content: string }>(
      `select content from public.product_reviews where id = $1`,
      [id],
    );
    expect(content).toContain('Ок');
    expect(content).not.toContain('script');
    expect(row.images).toEqual(refs);
  });

  it('🔴 updated_at зростає: нова версія для модерації', async () => {
    const { userId, id, refs } = await seeded(1);
    const before = await d.version(id);
    await edit(userId, id, { keep: refs });
    expect(await d.version(id)).not.toBe(before);
  });

  it('🔴 keep із чужим ключем → 409, нічого не змінено', async () => {
    const { userId, id, refs } = await seeded(1);
    const other = await d.seedBuyer({ avatar: true });
    await expect(
      edit(userId, id, { keep: [...refs, other.avatar!] }),
    ).rejects.toThrow(REVIEW_SUBMIT_ERROR.imagesChanged);
    expect(await d.reviewRow(id)).toMatchObject({
      status: 'approved',
      rating: 5,
      title: 'Старий',
      images: refs,
    });
    expect(d.hasFile(other.avatar!)).toBe(true);
  });

  it('🔴 keep + files > MAX → відмова ДО першого запису', async () => {
    const { userId, id, refs } = await seeded(2);
    const before = d.diskKeys();
    await expect(
      edit(userId, id, {
        keep: refs,
        files: Array.from({ length: MAX_REVIEW_IMAGES - 1 }, (_, i) =>
          png(40 + i),
        ),
      }),
    ).rejects.toThrow(REVIEW_SUBMIT_ERROR.tooManyImages);
    expect(d.diskKeys()).toEqual(before);
    expect((await d.reviewRow(id))!.status).toBe('approved');
  });

  it('прибране фото → рядок media стерто, файл прибрано після COMMIT', async () => {
    const { userId, id, refs } = await seeded(2);
    await edit(userId, id, { keep: [refs[0]!] });
    expect((await d.reviewRow(id))!.images).toEqual([refs[0]]);
    expect((await d.reviewMedia(id)).map((r) => r.storage_key)).toEqual([
      refs[0],
    ]);
    expect(d.hasFile(refs[0]!)).toBe(true);
    expect(d.hasFile(refs[1]!)).toBe(false);
  });

  it('нове фото → рядок media з власником review/<id>', async () => {
    const { userId, id, refs } = await seeded(1);
    await edit(userId, id, { keep: refs, files: [png(9)] });
    const row = (await d.reviewRow(id))!;
    expect(row.images).toHaveLength(2);
    expect(row.images![0]).toBe(refs[0]);
    const media = await d.reviewMedia(id);
    expect(media).toHaveLength(2);
    expect(
      media.every((m) => m.uploaded_by === userId || m.storage_key === refs[0]),
    ).toBe(true);
    expect(d.hasFile(row.images![1]!)).toBe(true);
  });

  it('🔴 COMMIT впав → новий файл прибрано, старий і media цілі, рядок не змінено', async () => {
    const { userId, id, refs } = await seeded(2);
    const disk = d.diskKeys();
    const unblock = await d.blockCommit('product_reviews', 'update');
    try {
      await expect(
        edit(userId, id, { keep: [refs[0]!], files: [png(9)] }),
      ).rejects.toThrow();
    } finally {
      await unblock();
    }
    expect(d.diskKeys()).toEqual(disk);
    expect(refs.every((r) => d.hasFile(r))).toBe(true);
    expect(await d.reviewMedia(id)).toHaveLength(2);
    expect(await d.reviewRow(id)).toMatchObject({
      status: 'approved',
      images: refs,
    });
  });

  it('🔴 own_photos: лише автору; гість і інший покупець не бачать референсів', async () => {
    const { userId, id, refs } = await seeded(2);
    const other = await d.seedUser('Інший');
    const photos = (rows: Awaited<ReturnType<typeof loadProductReviews>>) =>
      rows.find((r) => r.id === id)?.own_photos;
    const own = await withCustomerDb(userId, (db) =>
      loadProductReviews(db, f.ids.panel, userId),
    );
    expect(photos(own)!.map((p) => p.ref)).toEqual(refs);
    expect(photos(own)!.every((p) => p.url.includes(p.ref))).toBe(true);
    const asOther = await withCustomerDb(other, (db) =>
      loadProductReviews(db, f.ids.panel, other),
    );
    expect(photos(asOther)).toEqual([]);
    const asGuest = await withStorefrontDb((db) =>
      loadProductReviews(db, f.ids.panel),
    );
    expect(photos(asGuest)).toEqual([]);
    expect(JSON.stringify(asGuest)).not.toContain('"ref"');
  });

  it('🔴 чужий відгук → 404, відгук і файли цілі', async () => {
    const { id, refs } = await seeded(1);
    const other = await d.seedUser('Інший');
    await expect(edit(other, id, { keep: [] })).rejects.toThrow(
      REVIEW_SUBMIT_ERROR.notFound,
    );
    expect(await d.reviewRow(id)).toMatchObject({
      status: 'approved',
      title: 'Старий',
      images: refs,
    });
    expect(refs.every((r) => d.hasFile(r))).toBe(true);
  });
});
