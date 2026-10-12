// К3-Е6д, Task 7 (Е6д-14, аудит Codex р2 B2, р3 M3, р4 M4): аватар
// видаленого покупця сіду стирається ПІСЛЯ COMMIT зовнішньої транзакції сіду.
//
// 🔴 Аватар створюється окремою закоміченою транзакцією ДО зовнішньої: інакше
// відкат зовнішньої лишив би орфан-файл, нерозрізненний із цілим аватаром.
// Падіння пізнього кроку — підміна `shiftTime` на `throw`.
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { seedShowcase } from '../../../../../scripts/showcase/run.mts';
import { resolveHarness } from '../up.mjs';
import {
  mediaFiles,
  prepareShowcase,
  type SeededShowcase,
} from './fixtures/showcase-seed';

const fail = vi.hoisted(() => ({ shift: false }));

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('../../../../../scripts/showcase/raw-writes.mts', async (orig) => {
  const mod =
    await orig<
      typeof import('../../../../../scripts/showcase/raw-writes.mts')
    >();
  return {
    ...mod,
    shiftTime: async (...args: Parameters<typeof mod.shiftTime>) => {
      if (fail.shift) throw new Error('shift failed');
      return mod.shiftTime(...args);
    },
  };
});

const DELETED = 'buyer-18@showcase.test';

describe('сід вітрини: аватар видаленого покупця (Е6д-14)', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  let s: SeededShowcase | undefined;
  const users = async (h: SeededShowcase) =>
    (
      await h.rows<{ n: number }>(
        `select count(*)::int as n from public.users where email = $1`,
        [DELETED],
      )
    )[0]!.n;

  beforeAll(async () => {
    harness = await resolveHarness();
  });

  afterEach(async () => {
    fail.shift = false;
    vi.restoreAllMocks();
    await s?.cleanup();
    s = undefined;
  }, 120_000);

  it('успіх: файл стирається лише після COMMIT, орфанів у медіатеці немає', async () => {
    s = await prepareShowcase(harness.url, 'showcase_avatar_ok');
    const h = s;
    const real = h.env.media.delete.bind(h.env.media);
    // Окреме зʼєднання бачить лише закомічене: покупець має вже зникнути.
    const seenUsers: number[] = [];
    const del = vi
      .spyOn(h.env.media, 'delete')
      .mockImplementation(async (ref: string) => {
        seenUsers.push(await users(h));
        return real(ref);
      });
    await seedShowcase(h.env);
    expect(del).toHaveBeenCalledTimes(1);
    expect(seenUsers).toEqual([0]);
    const avatars = await h.rows(
      `select 1 from public.media where entity_type = 'avatar'`,
    );
    expect(avatars).toEqual([]);
    const keys = await h.rows<{ k: string }>(
      `select storage_key as k from public.media order by storage_key`,
    );
    expect(await mediaFiles(h.env.mediaRoot)).toEqual(
      keys.map((r) => r.k).sort(),
    );
  }, 300_000);

  it('🔴 крок після deleteCustomer впав → покупець, avatar_url, рядок media і файл на місці', async () => {
    s = await prepareShowcase(harness.url, 'showcase_avatar_fail');
    fail.shift = true;
    await expect(seedShowcase(s.env)).rejects.toThrow('shift failed');
    expect(await users(s)).toBe(1);
    const [row] = await s.rows<{ ref: string | null; media: number }>(
      `select p.avatar_url as ref,
              (select count(*)::int from public.media m
                where m.entity_type = 'avatar' and m.entity_id = p.user_id
                  and m.storage_key = p.avatar_url) as media
         from public.profiles p join public.users u on u.id = p.user_id
        where u.email = $1`,
      [DELETED],
    );
    expect(row?.ref).toBeTruthy();
    expect(row?.media).toBe(1);
    expect(await mediaFiles(s.env.mediaRoot)).toContain(row!.ref);
  }, 300_000);
});
