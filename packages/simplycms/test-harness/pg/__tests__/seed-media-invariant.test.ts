// К3-Е6д-4/5 (У2, У4): інваріант сіду вітрини. Кожен референс на файл сховища
// в колонках `MEDIA_COLUMNS` і в логотипі мусить мати рядок `media`, власник
// якого — саме сутність, що посилається. Інакше двофазне стирання на сідах —
// порожня операція (нічого прибрати за рядком), а роздача дала б 404.
// Гість без сесії бачить банери й фото схваленого відгуку.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { STORE_PROFILE_KEY } from 'simplycms/contracts/store-profile';
import {
  MEDIA_COLUMNS,
  normalizeMediaRefs,
  STORE_LOGO_OWNER_ID,
} from 'simplycms/domain/media';
import { MEDIA_KEY_RE } from 'simplycms/storage';
import { lookupMediaForRequest } from 'simplycms/storefront/media-visibility';
import { resolveHarness } from '../up.mjs';
import {
  seedFreshShowcase,
  type SeededShowcase,
} from './fixtures/showcase-seed';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig<typeof import('simplycms/auth')>()),
  readSessionSubject: vi.fn(async () => null),
}));

/** Власник файлу за таблицею-носієм; `idColumn` — яка колонка рядка є `entity_id`. */
const OWNER: Record<string, { type: string; idColumn: string }> = {
  products: { type: 'product', idColumn: 'id' },
  // М1: файли фото й перевизначень належать товару (вираз, бо в перекладі
  // немає `product_id`).
  product_images: { type: 'product', idColumn: 'product_id' },
  product_image_translations: {
    type: 'product',
    idColumn:
      '(select i.product_id from public.product_images i where i.id = image_id)',
  },
  product_modifications: { type: 'product_modification', idColumn: 'id' },
  product_reviews: { type: 'review', idColumn: 'id' },
  banners: { type: 'banner', idColumn: 'id' },
  sections: { type: 'section', idColumn: 'id' },
  property_options: { type: 'property_option', idColumn: 'id' },
  profiles: { type: 'avatar', idColumn: 'user_id' },
};

type Ref = { key: string; type: string; ownerId: string; where: string };

describe('сід вітрини: кожен референс має рядок media з власником (У4)', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  let s: SeededShowcase;
  const refs: Ref[] = [];

  beforeAll(async () => {
    harness = await resolveHarness();
    s = await seedFreshShowcase(harness.url, 'showcase_media_invariant');
    for (const { table, column, kind } of MEDIA_COLUMNS) {
      const owner = OWNER[table];
      if (!owner) throw new Error(`немає власника для ${table}`);
      const rows = await s.rows<{ owner: string; value: unknown }>(
        `select ${owner.idColumn}::text as owner, ${column} as value
           from public.${table} where ${column} is not null`,
      );
      for (const r of rows) {
        const values =
          kind === 'jsonb' ? normalizeMediaRefs(r.value) : [String(r.value)];
        for (const key of values)
          if (MEDIA_KEY_RE.test(key))
            refs.push({
              key,
              type: owner.type,
              ownerId: r.owner,
              where: `${table}.${column}`,
            });
      }
    }
    const [logo] = await s.rows<{ logo: string | null }>(
      `select value->>'logo' as logo from public.system_settings where key = $1`,
      [STORE_PROFILE_KEY],
    );
    if (logo?.logo && MEDIA_KEY_RE.test(logo.logo))
      refs.push({
        key: logo.logo,
        type: 'store_logo',
        ownerId: STORE_LOGO_OWNER_ID,
        where: 'system_settings.logo',
      });
  }, 300_000);

  afterAll(async () => {
    await s?.cleanup();
    await harness?.teardown();
  }, 120_000);

  it('сід справді містить референси на сховище (тест не порожній)', () => {
    expect(refs.length).toBeGreaterThan(30);
    expect(new Set(refs.map((r) => r.type))).toContain('product');
  });

  it('кожен референс має рядок media з власником-посилальником', async () => {
    for (const r of refs) {
      const row = await s.rows<{ entity_type: string; entity_id: string }>(
        `select entity_type, entity_id::text from public.media where storage_key = $1`,
        [r.key],
      );
      expect(row, `${r.where} ${r.key}: рядка media немає`).toHaveLength(1);
      expect(
        { type: row[0]!.entity_type, id: row[0]!.entity_id },
        `${r.where} ${r.key}`,
      ).toEqual({ type: r.type, id: r.ownerId });
    }
  });

  it('гість без сесії бачить банери й фото схваленого відгуку', async () => {
    const guest = new Request('http://localhost/media/x');
    const banners = refs.filter((r) => r.type === 'banner');
    expect(banners.length).toBeGreaterThan(0);
    for (const r of banners)
      expect(await lookupMediaForRequest(r.key, guest)).toEqual({
        personal: false,
      });
    const reviewPhotos = refs.filter((r) => r.type === 'review');
    for (const r of reviewPhotos)
      expect(await lookupMediaForRequest(r.key, guest)).toEqual({
        personal: true,
      });
  });
});
