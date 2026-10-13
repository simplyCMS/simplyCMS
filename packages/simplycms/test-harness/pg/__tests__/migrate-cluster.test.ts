// Вимога платформи «власний екземпляр Postgres на магазин» (Р28б′):
// `findForeignDatabases` бачить інші бази кластера, до яких `app_runtime` має
// CONNECT. Кластер харнеса спільний для паралельних файлів, тож перелік
// порівнюється за вмістом (є / немає), а не за точним складом.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyMigrations, findForeignDatabases } from 'simplycms/migrate';
import { resolveHarness } from '../up.mjs';
import { queryRows, withUser } from '../apply.mjs';
import { CANON_DIR, freshDb } from './fixtures/migrate';

const dbNameOf = (url: string) => new URL(url).pathname.slice(1);

describe('findForeignDatabases', () => {
  let harness: { url: string; teardown: () => Promise<void> };

  beforeAll(async () => {
    harness = await resolveHarness();
  }, 60_000);

  afterAll(async () => {
    await harness?.teardown();
  });

  it('друга база з журналом → в переліку; службові й поточна — ніколи', async () => {
    const mine = await freshDb(harness.url);
    const other = await freshDb(harness.url);
    try {
      await applyMigrations({ connectionString: mine.url, dir: CANON_DIR });
      await applyMigrations({ connectionString: other.url, dir: CANON_DIR });
      const found = await findForeignDatabases(
        withUser(mine.url, 'app_runtime'),
      );
      expect(found).toContain(dbNameOf(other.url));
      expect(found).not.toContain(dbNameOf(mine.url));
      for (const service of ['postgres', 'template0', 'template1'])
        expect(found).not.toContain(service);
    } finally {
      await other.drop();
      await mine.drop();
    }
  }, 120_000);

  it('база без журналу, але з CONNECT для app_runtime → в переліку; без CONNECT → ні', async () => {
    const mine = await freshDb(harness.url);
    const bare = await freshDb(harness.url);
    try {
      await applyMigrations({ connectionString: mine.url, dir: CANON_DIR });
      const bareName = dbNameOf(bare.url);
      const runtime = withUser(mine.url, 'app_runtime');
      expect(await findForeignDatabases(runtime)).toContain(bareName);

      await queryRows(
        harness.url,
        `revoke connect on database "${bareName}" from public`,
      );
      expect(await findForeignDatabases(runtime)).not.toContain(bareName);
    } finally {
      await bare.drop();
      await mine.drop();
    }
  }, 120_000);
});
