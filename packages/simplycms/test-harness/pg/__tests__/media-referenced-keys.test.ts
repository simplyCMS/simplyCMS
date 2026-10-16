// `findReferencedKeys` (один запит на гілку, `= ANY`) проти живої БД і його
// еквівалентність `mediaReferenceExists` (запит на ключ): колонка, jsonb-масив,
// jsonb не-масив, логотип, порожня множина.
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { withActor } from 'simplycms/db';
import { findReferencedKeys, mediaReferenceExists } from 'simplycms/storage';
import { useReviewsDb } from './fixtures/reviews';
import { insertProductGraph, viaRows } from './fixtures/product-graph';

describe('findReferencedKeys', () => {
  const d = useReviewsDb('simplycms_referenced_keys');
  const { f } = d;
  const fresh = () => `ab/${crypto.randomUUID()}.png`;
  const live = (keys: string[]) =>
    withActor({ role: 'app_admin' }, (db) => findReferencedKeys(db, keys));
  /** Еталон: той самий предикат реєстру, але по одному ключу. */
  const perKey = (keys: string[]) =>
    withActor({ role: 'app_admin' }, async (db) => {
      const out = new Set<string>();
      for (const key of keys) {
        const res = await db.execute<{ e: boolean }>(
          sql`select ${mediaReferenceExists(sql`${key}`)} as e`,
        );
        if (res.rows[0]!.e) out.add(key);
      }
      return out;
    });

  it('порожня множина → порожньо, запитів немає', async () => {
    expect(await live([])).toEqual(new Set());
  });

  it('колонка, jsonb-масив, логотип — знайдено; не-масив jsonb і невідомий ключ — ні; збігається з mediaReferenceExists', async () => {
    const [text, arr, logo, objKey, strKey, none, decoy] = [
      fresh(),
      fresh(),
      fresh(),
      fresh(),
      fresh(),
      fresh(),
      fresh(),
    ];
    const bannerId = crypto.randomUUID();
    await f.rows(
      `insert into public.banners (id, title, image_url) values ($1, 'B', $2)`,
      [bannerId, text],
    );
    const productId = crypto.randomUUID();
    await insertProductGraph(
      viaRows((q) => f.rows(q)),
      { id: productId, slug: `s-${productId}`, name: 'T', images: [arr] },
    );
    // Лише jsonb-колонка: фікстура графа дзеркалить фото в `product_images` (text-гілка).
    await f.rows(`delete from public.product_images where product_id = $1`, [
      productId,
    ]);
    // `images` — не масив: об'єкт і рядок не є посиланнями.
    for (const [value, slug] of [
      [{ k: objKey }, 'o'],
      [strKey, 's'],
    ] as const) {
      const id = crypto.randomUUID();
      await insertProductGraph(
        viaRows((q) => f.rows(q)),
        { id, slug: `${slug}-${id}`, name: 'N' },
      );
      await f.rows(
        `update public.products set images = $2::jsonb where id = $1`,
        [id, JSON.stringify(value)],
      );
    }
    await f.rows(
      `insert into public.system_settings (id, key, value) values ($1, 'store_profile', $2::jsonb)
       on conflict (key) do update set value = excluded.value`,
      [crypto.randomUUID(), JSON.stringify({ name: 'X', logo })],
    );
    // Не профіль магазину: `logo` в іншому рядку налаштувань посиланням не є.
    await f.rows(
      `insert into public.system_settings (id, key, value) values ($1, 'decoy', $2::jsonb)`,
      [crypto.randomUUID(), JSON.stringify({ logo: decoy })],
    );
    const keys = [text, arr, logo, objKey, strKey, none, decoy];
    const got = await live(keys);
    expect(got).toEqual(new Set([text, arr, logo]));
    expect(got).toEqual(await perKey(keys));
    await f.rows(
      `delete from public.system_settings where key = 'store_profile'`,
    );
  });
});
