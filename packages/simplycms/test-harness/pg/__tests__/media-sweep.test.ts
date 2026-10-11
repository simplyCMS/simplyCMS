// К3-Е6д-22: sweep неприв’язаних медіа. Стирає лише рядки старші за
// `MEDIA_SWEEP_MIN_AGE_HOURS` без жодного референсу; логотип, аватар і фото
// відгуку лишаються, бо їхні посилання бачить `findMediaReferences`.
import { describe, expect, it, vi } from 'vitest';
import { getMediaDriver } from 'simplycms/storage';
import { MEDIA_SWEEP_BATCH, STORE_LOGO_OWNER_ID } from 'simplycms/domain/media';
import { useCatalogMediaDb } from './fixtures/catalog-media';
import { blockCommitOn } from './fixtures/commit-block';
import { profile } from './fixtures/admin-system';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: null, roles: ['admin'] },
    scope: 'any',
  })),
}));

import {
  saveStoreProfileOp,
  sweepUnreferencedMediaOp,
} from 'simplycms/admin-server/impl';

describe('sweepUnreferencedMediaOp (Е6д-22)', () => {
  const d = useCatalogMediaDb('simplycms_e6d_media_sweep');
  const { f } = d;
  const age = (ref: string, hours: number) =>
    f.rows(
      `update public.media set created_at = now() - make_interval(hours => $2)
        where storage_key = $1`,
      [ref, hours],
    );
  const alive = async (ref: string) =>
    (await f.rows('select 1 from public.media where storage_key = $1', [ref]))
      .length === 1;

  it('25 год без референсу → стерто разом з файлом', async () => {
    const ref = await d.upload('banner', crypto.randomUUID());
    await age(ref, 25);
    const { erased } = await sweepUnreferencedMediaOp();
    expect(erased).toBeGreaterThanOrEqual(1);
    expect(await alive(ref)).toBe(false);
    expect(d.hasFile(ref)).toBe(false);
  });

  it('1 год без референсу → цілий', async () => {
    const ref = await d.upload('banner', crypto.randomUUID());
    await age(ref, 1);
    await sweepUnreferencedMediaOp();
    expect(await alive(ref)).toBe(true);
    expect(d.hasFile(ref)).toBe(true);
  });

  it('25 год з референсом у products.images → цілий', async () => {
    const productId = await d.product();
    const ref = await d.upload('product', productId);
    await f.rows(
      'update public.products set images = $2::jsonb where id = $1',
      [productId, JSON.stringify([ref])],
    );
    await age(ref, 25);
    await sweepUnreferencedMediaOp();
    expect(await alive(ref)).toBe(true);
    expect(d.hasFile(ref)).toBe(true);
  });

  it('логотип → цілий', async () => {
    const ref = await d.upload('store_logo', STORE_LOGO_OWNER_ID);
    await saveStoreProfileOp({ data: profile({ logo: ref }) });
    await age(ref, 25);
    await sweepUnreferencedMediaOp();
    expect(await alive(ref)).toBe(true);
    expect(d.hasFile(ref)).toBe(true);
  });

  it('аватар профілю → цілий', async () => {
    const user = await d.seedUser('Аватар', ['А', 'Б']);
    const ref = await d.upload('avatar', user);
    await f.rows(
      'update public.profiles set avatar_url = $2 where user_id = $1',
      [user, ref],
    );
    await age(ref, 25);
    await sweepUnreferencedMediaOp();
    expect(await alive(ref)).toBe(true);
    expect(d.hasFile(ref)).toBe(true);
  });

  it('фото відгуку → цілий', async () => {
    const reviewId = await d.seedReview();
    const ref = await d.upload('review', reviewId);
    await f.rows(
      'update public.product_reviews set images = $2::jsonb where id = $1',
      [reviewId, JSON.stringify([ref])],
    );
    await age(ref, 25);
    await sweepUnreferencedMediaOp();
    expect(await alive(ref)).toBe(true);
    expect(d.hasFile(ref)).toBe(true);
  });

  it('живих старих > пакета не затуляють сироту: сирота стертий, живі цілі', async () => {
    const n = MEDIA_SWEEP_BATCH + 1;
    // Живі (48 год, старші за сироту) — товар посилається на файл. Одним INSERT.
    await f.rows(
      `with g as (select gen_random_uuid() as pid, 'ab/live-' || gen_random_uuid() || '.png' as k
                    from generate_series(1, $1))
       , p as (insert into public.products (id, slug, name, images)
               select pid, 'live-' || pid, 'T', jsonb_build_array(k) from g)
       insert into public.media (id, entity_type, entity_id, storage_key, size_bytes, mime_type, created_at)
       select gen_random_uuid(), 'product', pid, k, 1, 'image/png', now() - interval '48 hours' from g`,
      [n],
    );
    const orphan = await d.upload('banner', crypto.randomUUID());
    await age(orphan, 25);
    await sweepUnreferencedMediaOp();
    expect(await alive(orphan)).toBe(false);
    const live = await f.rows<{ c: string }>(
      `select count(*)::text c from public.media where storage_key like 'ab/live-%'`,
    );
    expect(Number(live[0]!.c)).toBe(n);
  });

  it('COMMIT впав → файл і рядок цілі (файл стирається лише після COMMIT)', async () => {
    const ref = await d.upload('banner', crypto.randomUUID());
    await age(ref, 25);
    const spy = vi.spyOn(getMediaDriver(), 'delete');
    const unblock = await blockCommitOn((sql) => f.rows(sql), 'media');
    try {
      await expect(sweepUnreferencedMediaOp()).rejects.toThrow(
        /commit blocked/,
      );
      expect(spy).not.toHaveBeenCalled();
    } finally {
      await unblock();
      spy.mockRestore();
    }
    expect(await alive(ref)).toBe(true);
    expect(d.hasFile(ref)).toBe(true);
    await sweepUnreferencedMediaOp();
  });
});
