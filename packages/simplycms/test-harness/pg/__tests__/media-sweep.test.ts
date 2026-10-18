// К3-Е6д-22: sweep неприв’язаних медіа. Стирає лише рядки старші за
// `MEDIA_SWEEP_MIN_AGE_HOURS` без жодного референсу; логотип, аватар і фото
// відгуку лишаються, бо їхні посилання бачить `findMediaReferences`.
import { describe, expect, it, vi } from 'vitest';
import { getMediaDriver } from 'simplycms/storage';
import {
  MEDIA_SWEEP_BATCH,
  MEDIA_SWEEP_MAX_BATCHES,
  STORE_LOGO_OWNER_ID,
} from 'simplycms/domain/media';
import { useCatalogMediaDb } from './fixtures/catalog-media';
import { blockCommitOn } from './fixtures/commit-block';
import { profile } from './fixtures/admin-system';
import {
  inLockedBlock,
  productGraphStatements,
} from './fixtures/product-graph';

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

  it('25 год з референсом у product_images → цілий', async () => {
    const productId = crypto.randomUUID();
    const ref = await d.upload('product', productId);
    await d.product([ref], productId);
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
    const products = Array.from({ length: n }, () => ({
      pid: crypto.randomUUID(),
      key: `ab/live-${crypto.randomUUID()}.png`,
    }));
    await f.rows(
      inLockedBlock(
        products.flatMap(({ pid, key }) =>
          productGraphStatements({
            id: pid,
            slug: `live-${pid}`,
            name: 'T',
            images: [key],
          }),
        ),
      ),
    );
    await f.rows(
      `insert into public.media (id, entity_type, entity_id, storage_key, size_bytes, mime_type, created_at)
       select gen_random_uuid(), 'product', x.pid, x.k, 1, 'image/png', now() - interval '48 hours'
         from unnest($1::uuid[], $2::text[]) as x(pid, k)`,
      [products.map((l) => l.pid), products.map((l) => l.key)],
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

  /** `n` сиріт із власником `banner/<uuid>`, 48 год, ключі `ab/<prefix>-…` (файлів на диску немає — драйвер стирає ідемпотентно). */
  const seedOrphans = (prefix: string, n: number) =>
    f.rows(
      `insert into public.media (id, entity_type, entity_id, storage_key, size_bytes, mime_type, created_at)
       select gen_random_uuid(), 'banner', gen_random_uuid(),
              'ab/' || $2::text || '-' || g || '.png', 1, 'image/png', now() - interval '48 hours'
         from generate_series(1, $1) g`,
      [n, prefix],
    );
  const left = async (prefix: string) =>
    Number(
      (
        await f.rows<{ c: string }>(
          `select count(*)::text c from public.media where storage_key like $1`,
          [`ab/${prefix}-%`],
        )
      )[0]!.c,
    );

  it('сиріт більше за пакет, але в межах MAX_BATCHES → усі стерті за один виклик', async () => {
    const n = MEDIA_SWEEP_BATCH * 2 + 1;
    await seedOrphans('multi', n);
    const { erased } = await sweepUnreferencedMediaOp();
    expect(erased).toBeGreaterThanOrEqual(n);
    expect(await left('multi')).toBe(0);
  });

  it('стеля MAX_BATCHES: MAX×BATCH+1 сиріт → рівно MAX×BATCH стерто, один лишається', async () => {
    const cap = MEDIA_SWEEP_MAX_BATCHES * MEDIA_SWEEP_BATCH;
    // Чистимо чужих сиріт, щоб лічильник був точним (інші тести лишають лише живих/свіжих).
    await sweepUnreferencedMediaOp();
    await seedOrphans('cap', cap + 1);
    const first = await sweepUnreferencedMediaOp();
    expect(first.erased).toBe(cap);
    expect(await left('cap')).toBe(1);
    const second = await sweepUnreferencedMediaOp();
    expect(second.erased).toBe(1);
    expect(await left('cap')).toBe(0);
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
