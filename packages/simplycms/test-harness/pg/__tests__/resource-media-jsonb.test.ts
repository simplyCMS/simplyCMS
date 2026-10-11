// К3-Е6д-1: опція `media` фабрики на jsonb-масиві референсів (товар).
// Нові ключі — лише власні (409 `media_ref_invalid` інакше), прибрані —
// стираються двофазно: рядок `media` у транзакції, файл після COMMIT.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { productsOps as ops } from 'simplycms/admin-server/impl';
import { blockCommitOn } from './fixtures/commit-block';
import { useCatalogMediaDb } from './fixtures/catalog-media';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: null, roles: ['admin'] },
    scope: 'any',
  })),
}));

describe('фабрика: media на jsonb-масиві (К3-Е6д-1)', () => {
  const d = useCatalogMediaDb('simplycms_e6d_media_jsonb');
  afterEach(() => vi.restoreAllMocks());
  const images = (id: string) => d.column('products', id, 'images');

  it('update [a,b] → [b,c]: a стерто (рядок і файл), b і c цілі', async () => {
    const id = crypto.randomUUID();
    const [a, b] = [
      await d.upload('product', id),
      await d.upload('product', id),
    ];
    await d.f.rows(
      `insert into public.products (id, slug, name, images) values ($1, $2, 'Т', $3::jsonb)`,
      [id, `jb-${id.slice(0, 8)}`, JSON.stringify([a, b])],
    );
    const c = await d.upload('product', id);
    await ops.update({ data: [{ id, patch: { images: [b, c] } }] });
    expect(await images(id)).toEqual([b, c]);
    expect(await d.mediaRows(a)).toHaveLength(0);
    expect(d.hasFile(a)).toBe(false);
    for (const k of [b, c]) {
      expect(await d.mediaRows(k)).toHaveLength(1);
      expect(d.hasFile(k)).toBe(true);
    }
  });

  it('🔴 чужий ключ (фото іншого товару) → 409 media_ref_invalid, нічого не змінено', async () => {
    const other = await d.product();
    const foreign = await d.upload('product', other);
    const id = await d.product();
    await expect(
      ops.update({ data: [{ id, patch: { images: [foreign] } }] }),
    ).rejects.toMatchObject({ kind: 'state', constraint: 'media_ref_invalid' });
    expect(await images(id)).toEqual([]);
    expect(await d.mediaRows(foreign)).toHaveLength(1);
    expect(d.hasFile(foreign)).toBe(true);
  });

  it('🔴 COMMIT впав → a цілий (рядок і файл), driver.delete не викликано', async () => {
    const id = crypto.randomUUID();
    const a = await d.upload('product', id);
    await d.f.rows(
      `insert into public.products (id, slug, name, images) values ($1, $2, 'Т', $3::jsonb)`,
      [id, `jb-${id.slice(0, 8)}`, JSON.stringify([a])],
    );
    const spy = vi.spyOn(d.getMediaDriver(), 'delete');
    const unblock = await blockCommitOn(
      (sql) => d.f.rows(sql),
      'products',
      'update',
    );
    try {
      await expect(
        ops.update({ data: [{ id, patch: { images: [] } }] }),
      ).rejects.toThrow(/commit blocked/);
    } finally {
      await unblock();
    }
    expect(spy).not.toHaveBeenCalled();
    expect(await images(id)).toEqual([a]);
    expect(await d.mediaRows(a)).toHaveLength(1);
    expect(d.hasFile(a)).toBe(true);
  });

  it('remove товару стирає фото товару, його модифікацій і відгуків (файли — після COMMIT)', async () => {
    const id = crypto.randomUUID();
    const own = await d.upload('product', id);
    await d.f.rows(
      `insert into public.products (id, slug, name, images) values ($1, $2, 'Т', $3::jsonb)`,
      [id, `jb-${id.slice(0, 8)}`, JSON.stringify([own])],
    );
    const modId = crypto.randomUUID();
    const modPhoto = await d.upload('product_modification', modId);
    await d.f.rows(
      `insert into public.product_modifications (id, product_id, slug, name, images)
       values ($1, $2, 'm1', 'Мод', $3::jsonb)`,
      [modId, id, JSON.stringify([modPhoto])],
    );
    const reviewId = await d.seedReview({ productId: id });
    const [revPhoto] = await d.seedPhotos(reviewId, 1);
    await expect(ops.remove({ data: [{ id }] })).resolves.toEqual({ count: 1 });
    for (const k of [own, modPhoto, revPhoto!]) {
      expect(await d.mediaRows(k)).toHaveLength(0);
      expect(d.hasFile(k)).toBe(false);
    }
  });
});
