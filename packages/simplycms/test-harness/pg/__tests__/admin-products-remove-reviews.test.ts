// К3-Е6д, фінальне рев'ю (М1, Е6д-19): видалення товару стирає фото відгуків,
// яких FK `product_reviews.product_id` (CASCADE) знищує разом із ним.
// Двофазно (Е6д-14): рядки `media` — у транзакції, файли — після COMMIT.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { withActor } from 'simplycms/db';
import { productsOps } from 'simplycms/admin-server/impl';
import { holdRowLock, stillPending } from './fixtures/advisory-lock';
import { blockCommitOn } from './fixtures/commit-block';
import { useReviewsDb } from './fixtures/reviews';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: null, roles: ['admin'] },
    scope: 'any',
  })),
}));

describe('admin: видалення товару стирає фото його відгуків (Е6д-19)', () => {
  const d = useReviewsDb('simplycms_e6d_product_rm');
  const { f } = d;
  afterEach(() => vi.restoreAllMocks());

  /** Свіжий товар (без замовлень) з відгуком і двома фото. */
  const seeded = async () => {
    const productId = crypto.randomUUID();
    await f.rows(
      `insert into public.products (id, slug, name) values ($1, $2, 'Товар Е6д')`,
      [productId, `e6d-rm-${productId.slice(0, 8)}`],
    );
    const reviewId = await d.seedReview({ productId });
    const refs = await d.seedPhotos(reviewId, 2);
    return { productId, reviewId, refs };
  };
  const remove = (id: string) => productsOps.remove({ data: [{ id }] });
  const productExists = async (id: string) =>
    (await d.count('products', 'id = $1', [id])) === 1;

  it('успіх: товар, відгук, рядки media і файли зникли; чужий ключ цілий', async () => {
    const { productId, reviewId, refs } = await seeded();
    const b = await d.seedBuyer({ avatar: true });
    await f.rows(
      `update public.product_reviews set images = $2::jsonb where id = $1`,
      [reviewId, JSON.stringify([...refs, b.avatar])],
    );
    await expect(remove(productId)).resolves.toEqual({ count: 1 });
    expect(await d.exists(reviewId)).toBe(false);
    for (const r of refs) {
      expect(await d.mediaRows(r)).toHaveLength(0);
      expect(d.hasFile(r)).toBe(false);
    }
    expect(d.hasFile(b.avatar!)).toBe(true);
    expect(await d.mediaRows(b.avatar!)).toHaveLength(1);
  });

  it('🔴 COMMIT впав → товар, відгук, media і файли на місці, driver.delete не викликано', async () => {
    const { productId, reviewId, refs } = await seeded();
    const spy = vi.spyOn(d.getMediaDriver(), 'delete');
    const unblock = await blockCommitOn((sql) => f.rows(sql), 'products');
    try {
      await expect(remove(productId)).rejects.toThrow(/commit blocked/);
    } finally {
      await unblock();
    }
    expect(spy).not.toHaveBeenCalled();
    expect(await productExists(productId)).toBe(true);
    expect(await d.exists(reviewId)).toBe(true);
    for (const r of refs) {
      expect(await d.mediaRows(r)).toHaveLength(1);
      expect(d.hasFile(r)).toBe(true);
    }
  });

  it('driver.delete падає на другому файлі → товар і media видалено, один файл — орфан', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { productId, refs } = await seeded();
    const real = d.getMediaDriver();
    const del = real.delete.bind(real);
    let calls = 0;
    vi.spyOn(real, 'delete').mockImplementation(async (ref: string) => {
      if (++calls === 2) throw new Error('disk');
      return del(ref);
    });
    await expect(remove(productId)).resolves.toEqual({ count: 1 });
    expect(await productExists(productId)).toBe(false);
    for (const r of refs) expect(await d.mediaRows(r)).toHaveLength(0);
    expect(refs.filter((r) => d.hasFile(r))).toHaveLength(1);
  });

  it('removeIn без колектора discard — помилка програміста, товар цілий', async () => {
    const { productId } = await seeded();
    await expect(
      withActor({ role: 'app_admin' }, (tx) =>
        productsOps.removeIn(tx, [{ id: productId }]),
      ),
    ).rejects.toThrow(/discard/);
    expect(await productExists(productId)).toBe(true);
  });

  // 🔴 Гонка з подачею відгуку: вставка, що вже пройшла FK-перевірку (тримає
  // `FOR KEY SHARE` на товарі), мусить потрапити в знімок. Без лока батьків
  // знімок її не бачить, а каскад потім знищує відгук — рядок media лишається.
  it('паралельна незакомічена вставка відгуку з фото → її рядок media теж стерто', async () => {
    const { productId } = await seeded();
    const reviewId = crypto.randomUUID();
    const key = `rv/${reviewId}.png`;
    const rival = await holdRowLock(
      f.db.url,
      `insert into public.product_reviews (id, product_id, rating, status, images)
       values ($1, $2, 5, 'pending', $3::jsonb) returning id`,
      [reviewId, productId, JSON.stringify([key])],
    );
    try {
      await rival.query(
        `insert into public.media (id, entity_type, entity_id, storage_key, size_bytes, mime_type)
         values (gen_random_uuid(), 'review', $1, $2, 1, 'image/png')`,
        [reviewId, key],
      );
      const op = remove(productId);
      op.catch(() => {});
      expect(await stillPending(op, 300)).toBe(true);
      await rival.release();
      await expect(op).resolves.toEqual({ count: 1 });
    } finally {
      await rival.cleanup();
    }
    expect(await d.exists(reviewId)).toBe(false);
    expect(await d.mediaRows(key)).toHaveLength(0);
  });
});
