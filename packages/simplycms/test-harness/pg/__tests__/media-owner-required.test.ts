// К3-Е6д-4: `media.entity_id` NOT NULL — рядок без власника невидимий і для
// двофазного стирання, і для перевірки видимості при роздачі.
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { withActor } from 'simplycms/db';
import { useReviewsDb } from './fixtures/reviews';

describe('media.entity_id обовʼязковий (К3-Е6д-4)', () => {
  useReviewsDb('simplycms_e6d_media_owner');

  const insert = (owner: string | null) =>
    withActor({ role: 'app_admin' }, async (db) => {
      await db.execute(
        sql`insert into public.media (id, entity_type, entity_id, storage_key, size_bytes, mime_type)
            values (${crypto.randomUUID()}, 'product', ${owner}, ${`ab/${crypto.randomUUID()}.png`}, 1, 'image/png')`,
      );
    });

  it('вставка з entity_id = NULL падає з not-null violation (23502)', async () => {
    await expect(insert(null)).rejects.toMatchObject({
      cause: { code: '23502' },
    });
  });

  it('вставка з власником проходить', async () => {
    await expect(insert(crypto.randomUUID())).resolves.toBeUndefined();
  });
});
