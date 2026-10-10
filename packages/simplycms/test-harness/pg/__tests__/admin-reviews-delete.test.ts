// К3-Е6д, Task 6: видалення відгуку з двофазним стиранням фото (Е6д-14,
// Е6д-16). Статус — `-moderate`, негативна авторизація — `-authz`.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deleteReviewOp } from 'simplycms/admin-server/impl';
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

describe('admin: видалення відгуку (Е6д-14, Е6д-16)', () => {
  const d = useReviewsDb('simplycms_e6d_rv_del');
  const { f } = d;

  afterEach(() => vi.restoreAllMocks());

  it('два фото: рядок, рядки media і файли зникли', async () => {
    const id = await d.seedReview();
    const refs = await d.seedPhotos(id, 2);
    await deleteReviewOp({ data: { id } });
    expect(await d.exists(id)).toBe(false);
    for (const r of refs) {
      expect(await d.mediaRows(r)).toHaveLength(0);
      expect(d.hasFile(r)).toBe(false);
    }
  });

  it('неіснуючий → 409; images = NULL видаляється без помилки', async () => {
    await expect(
      deleteReviewOp({ data: { id: crypto.randomUUID() } }),
    ).rejects.toMatchObject(NOT_FOUND);
    const id = await d.seedReview({ images: null });
    await deleteReviewOp({ data: { id } });
    expect(await d.exists(id)).toBe(false);
  });

  it('транзакція впала → відгук, media і файли на місці, driver.delete не викликано', async () => {
    const id = await d.seedReview();
    const refs = await d.seedPhotos(id, 2);
    await f.rows(
      `create or replace function public.e6d_media_block() returns trigger
         language plpgsql as $$ begin raise exception 'blocked'; end $$`,
    );
    await f.rows(
      `create trigger e6d_media_block before delete on public.media
         for each row execute function public.e6d_media_block()`,
    );
    const spy = vi.spyOn(d.getMediaDriver(), 'delete');
    try {
      await expect(deleteReviewOp({ data: { id } })).rejects.toThrow();
    } finally {
      await f.rows(`drop trigger e6d_media_block on public.media`);
    }
    expect(spy).not.toHaveBeenCalled();
    expect(await d.exists(id)).toBe(true);
    for (const r of refs) {
      expect(await d.mediaRows(r)).toHaveLength(1);
      expect(d.hasFile(r)).toBe(true);
    }
  });

  it('driver.delete падає на другому файлі після COMMIT → запис і media видалено, файл — орфан', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const id = await d.seedReview();
    const refs = await d.seedPhotos(id, 2);
    const real = d.getMediaDriver();
    const del = real.delete.bind(real);
    let calls = 0;
    vi.spyOn(real, 'delete').mockImplementation(async (ref: string) => {
      if (++calls === 2) throw new Error('disk');
      return del(ref);
    });
    await expect(deleteReviewOp({ data: { id } })).resolves.toBeUndefined();
    expect(await d.exists(id)).toBe(false);
    for (const r of refs) expect(await d.mediaRows(r)).toHaveLength(0);
    expect(refs.filter((r) => d.hasFile(r))).toHaveLength(1);
  });

  it('🔴 чужий ключ у images (аватар покупця) → аватар і його media цілі (Е6д-16)', async () => {
    const b = await d.seedBuyer({ avatar: true });
    const id = await d.seedReview({ userId: b.userId });
    const [own] = await d.seedPhotos(id, 1);
    await f.rows(
      `update public.product_reviews set images = $2::jsonb where id = $1`,
      [id, JSON.stringify([own, b.avatar])],
    );
    await deleteReviewOp({ data: { id } });
    expect(await d.exists(id)).toBe(false);
    expect(d.hasFile(own!)).toBe(false);
    expect(d.hasFile(b.avatar!)).toBe(true);
    expect(await d.mediaRows(b.avatar!)).toHaveLength(1);
  });
});
