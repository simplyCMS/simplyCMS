// Фінальне рев'ю М1, раунд 3 (R2-4): повторний накат з тим самим паролем `app_runtime` нічого не
// пише в `pg_authid` — рядок ролі в спільному каталозі кластера, і безумовний `alter role` з
// випадковою сіллю при паралельних накатах давав `tuple concurrently updated` (клас флейку
// `start-migrate`).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyMigrations } from 'simplycms/migrate';
import { resolveHarness } from '../up.mjs';
import { queryRows } from '../apply.mjs';
import { CANON_DIR, freshDb } from './fixtures/migrate';

const PASSWORD = 'Idem-P4ss';

const roleRow = async (url: string) =>
  (
    (await queryRows(
      url,
      `select xmin::text as xmin, rolpassword from pg_authid where rolname = 'app_runtime'`,
    )) as { xmin: string; rolpassword: string | null }[]
  )[0]!;

describe('пароль app_runtime: повторний накат без запису (R2-4)', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  let db: Awaited<ReturnType<typeof freshDb>>;
  let saved: string | null = null;

  beforeAll(async () => {
    harness = await resolveHarness();
    db = await freshDb(harness.url);
    saved = (await roleRow(harness.url)).rolpassword;
  }, 120_000);

  afterAll(async () => {
    // Пароль ролі кластера — як до файла.
    await queryRows(
      harness.url,
      saved === null
        ? 'alter role app_runtime password null'
        : `alter role app_runtime password '${saved.replace(/'/g, "''")}'`,
    );
    await db?.drop();
    await harness?.teardown();
  });

  it('другий накат з тим самим паролем: рядок pg_authid той самий (xmin), синк — так', async () => {
    const runtimeUrl = (() => {
      const u = new URL(db.url);
      u.username = 'app_runtime';
      u.password = PASSWORD;
      return u.toString();
    })();
    await applyMigrations({
      connectionString: db.url,
      dir: CANON_DIR,
      runtimeUrl,
    });
    const before = await roleRow(harness.url);
    const lines: string[] = [];
    const report = await applyMigrations({
      connectionString: db.url,
      dir: CANON_DIR,
      runtimeUrl,
      log: (l) => lines.push(l),
    });
    expect(report.runtimePasswordSynced).toBe(true);
    expect(lines.join('\n')).toContain('уже синхронізовано');
    expect(await roleRow(harness.url)).toEqual(before);
  }, 120_000);
});
