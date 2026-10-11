// К3-Е6д-22: `deleteMedia` відмовляє 409 `media_in_use`, поки файл хтось
// використовує (text- і jsonb-колонка, логотип); неприв’язаний стирається,
// зовнішній URL — `removed: false`.
import { describe, expect, it, vi } from 'vitest';
import { withActor } from 'simplycms/db';
import { STORE_LOGO_OWNER_ID } from 'simplycms/domain/media';
import { writeMedia } from 'simplycms/storage';
import { png } from './fixtures/review-photos';
import { useCatalogMediaDb } from './fixtures/catalog-media';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: null, roles: ['admin'] },
    scope: 'any',
  })),
}));

import { deleteMediaOp, saveStoreProfileOp } from 'simplycms/admin-server/impl';
import { profile } from './fixtures/admin-system';

const inUse = {
  name: 'AdminConflictError',
  kind: 'state',
  constraint: 'media_in_use',
};

describe('deleteMedia: media_in_use (Е6д-22)', () => {
  const d = useCatalogMediaDb('simplycms_e6d_delete_in_use');
  const { f } = d;
  const owned = (type: string, ownerId: string | null) =>
    withActor({ role: 'app_admin' }, (db) =>
      writeMedia(db, {
        ...png(7),
        entityType: type,
        entityId: ownerId,
        uploadedBy: null,
      }),
    ).then((r) => r.ref);
  const rowAlive = async (ref: string) =>
    (await f.rows('select 1 from public.media where storage_key = $1', [ref]))
      .length === 1;

  it('banners.image_url → 409, рядок і файл цілі', async () => {
    const ref = await owned('banner', null);
    await f.rows(
      `insert into public.banners (id, title, image_url) values (gen_random_uuid(), 'B', $1)`,
      [ref],
    );
    await expect(deleteMediaOp({ data: { ref } })).rejects.toMatchObject(inUse);
    expect(await rowAlive(ref)).toBe(true);
    expect(d.hasFile(ref)).toBe(true);
  });

  it('products.images (jsonb) → 409', async () => {
    const productId = await d.product();
    const ref = await d.upload('product', productId);
    await f.rows(
      'update public.products set images = $2::jsonb where id = $1',
      [productId, JSON.stringify([ref])],
    );
    await expect(deleteMediaOp({ data: { ref } })).rejects.toMatchObject(inUse);
    expect(d.hasFile(ref)).toBe(true);
  });

  it('чинний логотип → 409', async () => {
    const ref = await owned('store_logo', STORE_LOGO_OWNER_ID);
    await saveStoreProfileOp({ data: profile({ logo: ref }) });
    await expect(deleteMediaOp({ data: { ref } })).rejects.toMatchObject(inUse);
    expect(d.hasFile(ref)).toBe(true);
  });

  it('неприв’язаний → стерто', async () => {
    const ref = await owned('banner', null);
    await expect(deleteMediaOp({ data: { ref } })).resolves.toEqual({
      removed: true,
    });
    expect(await rowAlive(ref)).toBe(false);
    expect(d.hasFile(ref)).toBe(false);
  });

  it('зовнішній URL → removed: false', async () => {
    await expect(
      deleteMediaOp({ data: { ref: 'https://cdn.example/x.png' } }),
    ).resolves.toEqual({ removed: false });
  });
});
