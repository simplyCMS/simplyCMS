// `findReferencedKeys` (один запит на гілку, `= ANY`) проти живої БД і його
// еквівалентність `mediaReferenceExists` (запит на ключ): колонка, jsonb-масив,
// jsonb не-масив, логотип, порожня множина.
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { withActor } from 'simplycms/db';
import { findReferencedKeys, mediaReferenceExists } from 'simplycms/storage';
import { useReviewsDb } from './fixtures/reviews';

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
    // jsonb-масив референсів — фото відгуку (jsonb `products.images` знесено, М1).
    await d.seedReview({ images: [arr] });
    // `images` — не масив: об'єкт і рядок не є посиланнями.
    for (const value of [{ k: objKey }, strKey])
      await d.seedReview({ images: value });
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
