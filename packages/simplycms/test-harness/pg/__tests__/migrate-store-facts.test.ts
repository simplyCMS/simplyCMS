// `readStoreFacts` (К3-Е8, Task 21): факти про магазин з рантайм-підключення —
// той самий канал `SET LOCAL ROLE app_admin`, що й у журналу.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyMigrations, readStoreFacts } from 'simplycms/migrate';
import { resolveHarness } from '../up.mjs';
import { queryRows, withUser } from '../apply.mjs';
import { CANON_DIR, freshDb } from './fixtures/migrate';

describe('readStoreFacts', () => {
  let harness: { url: string; teardown: () => Promise<void> };

  beforeAll(async () => {
    harness = await resolveHarness();
  }, 60_000);

  afterAll(async () => {
    await harness?.teardown();
  });

  it('свіжа база: власників нема, профіль із сіду без email, листів нема', async () => {
    const db = await freshDb(harness.url);
    try {
      await applyMigrations({ connectionString: db.url, dir: CANON_DIR });
      const facts = await readStoreFacts(withUser(db.url, 'app_runtime'));
      expect(facts).toEqual({
        owners: 0,
        profile: { name: 'Мій магазин', email: null },
        failedMail: 0,
      });
    } finally {
      await db.drop();
    }
  }, 120_000);

  it('адмін-роль рахується, звичайний користувач ні; email профілю і невдалі листи читаються', async () => {
    const db = await freshDb(harness.url);
    const userId = '10000000-0000-4000-8000-000000000001';
    const otherId = '10000000-0000-4000-8000-000000000002';
    try {
      await applyMigrations({ connectionString: db.url, dir: CANON_DIR });
      for (const [id, email] of [
        [userId, 'owner@example.com'],
        [otherId, 'buyer@example.com'],
      ])
        await queryRows(
          db.url,
          'insert into public.users (id, name, email) values ($1::uuid, $2, $2)',
          [id, email],
        );
      await queryRows(
        db.url,
        `insert into public.user_roles (id, user_id, role) values
           ('20000000-0000-4000-8000-000000000001', $1, 'admin'),
           ('20000000-0000-4000-8000-000000000002', $2, 'user')`,
        [userId, otherId],
      );
      await queryRows(
        db.url,
        `update public.system_settings
            set value = jsonb_set(value, '{contacts,email}', '"shop@example.com"')
          where key = 'store_profile'`,
      );
      // attempts = 0 — лист ще не пробували слати (друга фаза після COMMIT), не «невдалий».
      await queryRows(
        db.url,
        `insert into public.mail_outbox (id, kind, message, attempts, last_error) values
           ('30000000-0000-4000-8000-000000000001', 'order', '{}', 0, null),
           ('30000000-0000-4000-8000-000000000002', 'order', '{}', 2, 'smtp down')`,
      );
      expect(await readStoreFacts(withUser(db.url, 'app_runtime'))).toEqual({
        owners: 1,
        profile: { name: 'Мій магазин', email: 'shop@example.com' },
        failedMail: 1,
      });
    } finally {
      await db.drop();
    }
  }, 120_000);

  it('рядка профілю нема → profile: null', async () => {
    const db = await freshDb(harness.url);
    try {
      await applyMigrations({ connectionString: db.url, dir: CANON_DIR });
      await queryRows(
        db.url,
        "delete from public.system_settings where key = 'store_profile'",
      );
      const facts = await readStoreFacts(withUser(db.url, 'app_runtime'));
      expect(facts.profile).toBeNull();
    } finally {
      await db.drop();
    }
  }, 120_000);
});
