// К3-Е6д-3: аватар (заміна й очищення) і логотип на двофазному
// стиранні. Обрив саме на COMMIT (відкладений тригер) доводить, що файл
// стирається ПІСЛЯ нього: старий файл і рядок `media` лишаються цілі.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { withActor } from 'simplycms/db';
import { STORE_LOGO_OWNER_ID } from 'simplycms/domain/media';
import { writeMedia } from 'simplycms/storage';
import { blockCommitOn } from './fixtures/commit-block';
import { png } from './fixtures/review-photos';
import { useReviewsDb } from './fixtures/reviews';

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

import { saveStoreProfileOp } from 'simplycms/admin-server/impl';
import { removeMyAvatar } from 'simplycms/core/lib/profile-avatar';
import { replaceAvatar } from 'simplycms/storefront/loaders';
import { profile } from './fixtures/admin-system';

describe('двофазне стирання: аватар, логотип (К3-Е6д-3)', () => {
  const d = useReviewsDb('simplycms_e6d_two_phase_singletons');
  const { f } = d;
  let unblock: (() => Promise<unknown>) | null = null;
  afterEach(async () => {
    await unblock?.();
    unblock = null;
    await f.rows('delete from public.media_erasures');
    await f.rows(
      `delete from public.system_settings where key = 'store_profile'`,
    );
  });

  const put = (entityType: string, entityId: string) =>
    withActor({ role: 'app_admin' }, (db) =>
      writeMedia(db, {
        ...png(Math.floor(Math.random() * 200)),
        entityType,
        entityId,
        uploadedBy: null,
      }),
    ).then((r) => r.ref);
  const rowOf = async (ref: string) =>
    (await f.rows('select 1 from public.media where storage_key = $1', [ref]))
      .length === 1;
  const both = async (ref: string) => ({
    row: await rowOf(ref),
    file: d.hasFile(ref),
  });
  const tails = async () =>
    (await f.rows('select 1 from public.media_erasures')).length;
  const alive = { row: true, file: true };
  const gone = { row: false, file: false };

  async function buyerWithAvatar() {
    const userId = await d.seedUser('Аватар', ['А', 'Б']);
    const ref = await put('avatar', userId);
    await f.rows(
      'update public.profiles set avatar_url = $2 where user_id = $1',
      [userId, ref],
    );
    session.userId = userId;
    return { userId, ref };
  }
  const avatarUrl = async (userId: string) =>
    (
      await f.one<{ avatar_url: string | null }>(
        'select avatar_url from public.profiles where user_id = $1',
        [userId],
      )
    ).avatar_url;

  it('заміна аватара: обрив COMMIT → старий цілий, профіль незмінний', async () => {
    const { userId, ref } = await buyerWithAvatar();
    unblock = await blockCommitOn((q) => f.rows(q), 'profiles', 'update');
    await expect(replaceAvatar(userId, png())).rejects.toThrow();
    expect(await both(ref)).toEqual(alive);
    expect(await avatarUrl(userId)).toBe(ref);
  });

  it('заміна аватара: успіх → старий рядок і файл стерто, outbox порожній', async () => {
    const { userId, ref } = await buyerWithAvatar();
    const next = await replaceAvatar(userId, png());
    expect(await both(ref)).toEqual(gone);
    expect(await avatarUrl(userId)).toBe(next.ref);
    expect(await tails()).toBe(0);
  });

  it('очищення аватара: обрив COMMIT → цілий; успіх → стерто', async () => {
    const { userId, ref } = await buyerWithAvatar();
    unblock = await blockCommitOn((q) => f.rows(q), 'profiles', 'update');
    await expect(removeMyAvatar()).rejects.toThrow();
    expect(await both(ref)).toEqual(alive);
    await unblock();
    unblock = null;
    await removeMyAvatar();
    expect(await both(ref)).toEqual(gone);
    expect(await avatarUrl(userId)).toBeNull();
  });

  it('заміна логотипа: обрив COMMIT → старий цілий; успіх → стерто', async () => {
    const old = await put('store_logo', STORE_LOGO_OWNER_ID);
    const next = await put('store_logo', STORE_LOGO_OWNER_ID);
    await saveStoreProfileOp({ data: profile({ logo: old }) });
    unblock = await blockCommitOn((q) => f.rows(q), 'media', 'delete');
    await expect(
      saveStoreProfileOp({ data: profile({ logo: next }) }),
    ).rejects.toThrow();
    expect(await both(old)).toEqual(alive);
    await unblock();
    unblock = null;
    await saveStoreProfileOp({ data: profile({ logo: next }) });
    expect(await both(old)).toEqual(gone);
    expect(await both(next)).toEqual(alive);
  });
});
