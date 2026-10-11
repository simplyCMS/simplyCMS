// К3-Е6д, Task 4 (Е6д-20/20а/20б): outbox стирання `media_erasures` проти
// живої БД. Фейк-драйвер падає на ключах `failOn`; «після COMMIT» розрізняє
// порядок лише відкладений тригер на COMMIT.
import { sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withActor } from 'simplycms/db';
import { deleteMyProductReview } from 'simplycms/core/lib/review-form';
import { uploadMediaOp } from 'simplycms/admin-server/impl';
import { submitReviewWithImages } from 'simplycms/storefront/loaders';
import {
  completeMediaErasures,
  eraseMediaRows,
  listMediaErasures,
  retryMediaErasures,
  scheduleMediaErasures,
  type MediaStorageDriver,
} from 'simplycms/storage';
import { blockCommitOn } from './fixtures/commit-block';
import { png, pngFile, useReviewPhotosDb } from './fixtures/review-photos';

const session = vi.hoisted(() => ({ userId: '' }));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    const builder = { validator: () => builder, handler: (fn: unknown) => fn };
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
  requireGrant: vi.fn(async () => ({
    subject: { userId: null, roles: ['admin'] },
    scope: 'any',
  })),
}));

type Tail = {
  storage_key: string;
  attempts: number;
  last_error: string | null;
};

describe('outbox стирання медіа (Е6д-20)', () => {
  const d = useReviewPhotosDb('simplycms_e6d_erasures');
  const { f } = d;

  /** Фейк над справжнім сховищем: `delete` падає для ключів із `failOn`. */
  const failOn = new Set<string>();
  const fake = (): MediaStorageDriver => {
    const real = d.getMediaDriver();
    return {
      ...real,
      put: real.put.bind(real),
      open: real.open.bind(real),
      delete: async (key) => {
        if (failOn.has(key)) throw new Error(`disk: ${key}`);
        return real.delete(key);
      },
    };
  };
  const tails = () =>
    f.rows<Tail>(
      `select storage_key, attempts, last_error from public.media_erasures order by storage_key`,
    );
  /** Фото відгуку + `eraseMediaRows` у транзакції; повертає стерті ключі. */
  const erase = async (n = 1) => {
    const reviewId = await d.seedReview();
    const refs = await d.seedPhotos(reviewId, n);
    const keys = await withActor({ role: 'app_admin' }, (db) =>
      eraseMediaRows(db, refs, { entityType: 'review', entityId: reviewId }),
    );
    return { keys, refs };
  };

  beforeEach(async () => {
    failOn.clear();
    await f.rows('delete from public.media_erasures');
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it('eraseMediaRows + COMMIT → рядок outbox існує до completeMediaErasures', async () => {
    const { keys, refs } = await erase(2);
    expect((await tails()).map((t) => t.storage_key)).toEqual(keys);
    expect(refs.every((r) => d.hasFile(r))).toBe(true);
  });

  it('успіх → outbox порожній і файлу немає', async () => {
    const { keys } = await erase(2);
    await completeMediaErasures(keys);
    expect(await tails()).toEqual([]);
    expect(keys.some((k) => d.hasFile(k))).toBe(false);
  });

  it('🔴 драйвер падає → рядок лишився, attempts = 1, last_error, не кинуло', async () => {
    const { keys } = await erase(1);
    failOn.add(keys[0]!);
    await expect(completeMediaErasures(keys, fake())).resolves.toBeUndefined();
    const [row] = await tails();
    expect(row).toMatchObject({ storage_key: keys[0], attempts: 1 });
    expect(row!.last_error).toContain('disk');
    expect(d.hasFile(keys[0]!)).toBe(true);
  });

  it('наступний complete добирає хвіст старший за хвилину', async () => {
    const stale = await erase(1);
    failOn.add(stale.keys[0]!);
    await completeMediaErasures(stale.keys, fake());
    failOn.clear();
    await f.rows(
      `update public.media_erasures set requested_at = now() - interval '2 minutes'`,
    );
    const other = await erase(1);
    await completeMediaErasures(other.keys, fake());
    expect(await tails()).toEqual([]);
    expect(d.hasFile(stale.keys[0]!)).toBe(false);
  });

  it('свіжий хвіст опортуністично НЕ чіпається', async () => {
    const stale = await erase(1);
    failOn.add(stale.keys[0]!);
    await completeMediaErasures(stale.keys, fake());
    failOn.clear();
    const other = await erase(1);
    await completeMediaErasures(other.keys, fake());
    expect((await tails()).map((t) => t.storage_key)).toEqual(stale.keys);
  });

  it('відкат транзакції eraseMediaRows → outbox порожній, media на місці', async () => {
    const reviewId = await d.seedReview();
    const refs = await d.seedPhotos(reviewId, 1);
    await expect(
      withActor({ role: 'app_admin' }, async (db) => {
        await eraseMediaRows(db, refs, {
          entityType: 'review',
          entityId: reviewId,
        });
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    expect(await tails()).toEqual([]);
    expect(await d.mediaRows(refs[0]!)).toHaveLength(1);
  });

  it('retryMediaErasures повертає лічильники; list бачить хвости', async () => {
    const { keys } = await erase(2);
    failOn.add(keys[0]!);
    await expect(retryMediaErasures(5, fake())).resolves.toEqual({
      done: 1,
      failed: 1,
    });
    const list = await withActor({ role: 'app_admin' }, (db) =>
      listMediaErasures(db),
    );
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ storageKey: keys[0], attempts: 1 });
    expect(list[0]!.requestedAt).toBeInstanceOf(Date);
  });

  it('🔴 app_user не бачить outbox: permission denied', async () => {
    await expect(
      withActor({ role: 'app_user' }, (db) =>
        db.execute(sql`select * from public.media_erasures`),
      ),
    ).rejects.toMatchObject({
      cause: {
        code: '42501',
        message: expect.stringContaining('permission denied'),
      },
    });
  });

  it('🔴 службова транзакція не приписує дію людині: app.user_id порожній (Е6д-20а)', async () => {
    await f.rows(`create table if not exists public.e6d_actor_log (uid text)`);
    await f.rows(
      `create or replace function public.e6d_actor_log() returns trigger
         language plpgsql as $$ begin
           insert into public.e6d_actor_log values (coalesce(current_setting('app.user_id', true), ''));
           return null; end $$`,
    );
    await f.rows(
      `create trigger e6d_actor_log after insert or update or delete on public.media_erasures
         for each row execute function public.e6d_actor_log()`,
    );
    await f.rows('grant insert on public.e6d_actor_log to app_admin');
    try {
      const { keys } = await erase(1);
      await f.rows('delete from public.e6d_actor_log');
      const key = `aa/${crypto.randomUUID()}.png`;
      await scheduleMediaErasures([key]);
      failOn.add(keys[0]!);
      await completeMediaErasures([keys[0]!, key], fake());
      const log = await f.rows<{ uid: string }>(
        'select uid from public.e6d_actor_log',
      );
      expect(log.length).toBeGreaterThanOrEqual(3);
      expect(log.every((r) => r.uid === '')).toBe(true);
    } finally {
      await f.rows(`drop trigger e6d_actor_log on public.media_erasures`);
      await f.rows(`drop table public.e6d_actor_log`);
      await f.rows(`drop function public.e6d_actor_log()`);
    }
  });

  it('🔴 публічний шлях: покупець видаляє відгук, драйвер падає → рядок outbox', async () => {
    const userId = await d.seedUser('Автор');
    const { id } = await submitReviewWithImages(
      userId,
      { productId: f.ids.panel, rating: 5, title: null, content: null },
      [png(1)],
    );
    const refs = (await d.reviewRow(id))!.images!;
    vi.spyOn(d.getMediaDriver(), 'delete').mockRejectedValue(new Error('disk'));
    session.userId = userId;
    const del = deleteMyProductReview as unknown as (a: {
      data: { reviewId: string };
    }) => Promise<boolean>;
    await expect(del({ data: { reviewId: id } })).resolves.toBe(true);
    expect((await tails()).map((t) => t.storage_key)).toEqual(refs);
    expect((await tails())[0]!.attempts).toBe(1);
  });

  it('🔴 Е6д-20б: подача відгуку падає на COMMIT, прибирання падає → outbox має ключ', async () => {
    const userId = await d.seedUser('Автор');
    const before = d.diskKeys();
    const unblock = await blockCommitOn(
      (q) => f.rows(q),
      'product_reviews',
      'insert',
    );
    const broken = fake();
    const real = d.getMediaDriver();
    const driver = { ...broken, put: real.put.bind(real) };
    vi.spyOn(real, 'delete').mockRejectedValue(new Error('disk'));
    try {
      await expect(
        submitReviewWithImages(
          userId,
          { productId: f.ids.panel, rating: 5, title: null, content: null },
          [png(2)],
          { driver: real, discardWith: driver },
        ),
      ).rejects.toThrow();
    } finally {
      await unblock();
    }
    const published = d.diskKeys().filter((k) => !before.includes(k));
    expect(published).toHaveLength(1);
    expect((await tails()).map((t) => t.storage_key)).toEqual(published);
  });

  it('🔴 Е6д-20б: адмінський uploadMedia падає на COMMIT, прибирання падає → outbox має ключ', async () => {
    const before = d.diskKeys();
    const unblock = await blockCommitOn((q) => f.rows(q), 'media', 'insert');
    vi.spyOn(d.getMediaDriver(), 'delete').mockRejectedValue(new Error('disk'));
    const form = new FormData();
    form.set('file', pngFile(3));
    form.set('entityType', 'banner');
    try {
      await expect(uploadMediaOp({ data: form })).rejects.toThrow();
    } finally {
      await unblock();
    }
    const published = d.diskKeys().filter((k) => !before.includes(k));
    expect(published).toHaveLength(1);
    expect((await tails()).map((t) => t.storage_key)).toEqual(published);
  });
});
