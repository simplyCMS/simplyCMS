// Гейт С-8(б): два прогони сіду на двох чистих базах із двома різними
// медіатеками дають однаковий нормалізований знімок (С-6).
//
// 🔴 Це доказ Review Focus 1: друга база команди має ті самі назви й суми,
// що й перша. Знімок — без uuid і `ref`, дати — день-зсувами
// (`fixtures/showcase-snapshot.ts`). Медіатеки різні навмисно: сід пише
// файли явним драйвером, а не кешованим `getMediaDriver()` — інакше друга
// база писала б у теку першої, і перевірка «файл на кожен рядок» це ловить.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveHarness } from '../up.mjs';
import {
  mediaFiles,
  seedFreshShowcase,
  type SeededShowcase,
} from './fixtures/showcase-seed';
import {
  showcaseSnapshot,
  type ShowcaseSnapshot,
} from './fixtures/showcase-snapshot';

describe('сід вітрини: детермінованість (С-8б)', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const seeded: SeededShowcase[] = [];
  const snapshots: ShowcaseSnapshot[] = [];

  beforeAll(async () => {
    harness = await resolveHarness();
    for (const prefix of ['showcase_det_a', 'showcase_det_b']) {
      // Знімок — одразу після свого сіду: день-зсув рахується від `now()`.
      const s = await seedFreshShowcase(harness.url, prefix);
      seeded.push(s);
      snapshots.push(await showcaseSnapshot(s));
    }
  }, 600_000);

  afterAll(async () => {
    for (const s of seeded) await s.cleanup();
    await harness?.teardown();
  }, 120_000);

  it('знімок не порожній — рівність не тривіальна', () => {
    const [a] = snapshots;
    expect(a!.products.length).toBeGreaterThan(30);
    expect(a!.orders.length).toBeGreaterThanOrEqual(30);
    expect(a!.reviews.length).toBeGreaterThan(10);
    expect(a!.history.length).toBeGreaterThan(0);
    expect(
      new Set(a!.orders.map((o) => (o as { day: number }).day)).size,
    ).toBeGreaterThan(5);
  });

  it('дві чисті бази → однаковий нормалізований знімок', () => {
    const [a, b] = snapshots;
    for (const key of Object.keys(a!) as (keyof ShowcaseSnapshot)[]) {
      expect(b![key], key).toEqual(a![key]);
    }
  });

  it('дві різні медіатеки: файл на кожен рядок `media`, і лише у своїй теці', async () => {
    const [a, b] = seeded;
    expect(a!.env.mediaRoot).not.toBe(b!.env.mediaRoot);
    for (const s of seeded) {
      const refs = (
        await s.rows<{ ref: string }>(
          `select storage_key as ref from public.media order by 1`,
        )
      ).map((r) => r.ref);
      expect(refs.length).toBeGreaterThan(30);
      expect(await mediaFiles(s.env.mediaRoot)).toEqual(refs);
    }
  });
});
