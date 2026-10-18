// Фінальне рев'ю М1, раунд 5: роль накату без SUPERUSER (як у керованих Postgres — лише
// CREATEROLE і власник БД) → накат падає з кодом 42501 і прямою підказкою про вимогу SUPERUSER,
// а не лише сирим «permission denied». Журнал лишається без записів: файл відкочено цілком.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyMigrations } from 'simplycms/migrate';
import * as H from '../apply.mjs';
import { resolveHarness } from '../up.mjs';
import { CANON_DIR } from './fixtures/migrate';

describe('накат під роллю без SUPERUSER', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const role = H.randomDbName('nosu_migrator');
  const db = H.randomDbName('simplycms_nosu');
  let created = false;

  beforeAll(async () => {
    harness = await resolveHarness();
    await H.queryRows(harness.url, `create role ${role} login createrole`);
    created = true;
    await H.createTempDatabase(harness.url, db);
    await H.queryRows(harness.url, `alter database "${db}" owner to ${role}`);
  });

  afterAll(async () => {
    await H.dropTempDatabase(harness.url, db);
    if (created) await H.queryRows(harness.url, `drop role if exists ${role}`);
    await harness?.teardown();
  });

  it('42501 → підказка про SUPERUSER; журнал без записів', async () => {
    const url = H.withUser(H.withDbName(harness.url, db), role);
    const err = await applyMigrations({
      connectionString: url,
      dir: CANON_DIR,
    }).catch((e: unknown) => e as Error & { cause?: { code?: string } });
    expect(err).toBeInstanceOf(Error);
    expect((err as { cause?: { code?: string } }).cause?.code).toBe('42501');
    expect((err as Error).message).toMatch(
      /^\[simplycms\/migrate\] Накат 0000_prelude\.sql впав: .*мусить бути SUPERUSER кластера/,
    );
    const rows = await H.queryRows(
      H.withDbName(harness.url, db),
      `select count(*)::int as n from public.simplycms_migrations`,
    );
    expect(rows[0].n).toBe(0);
  }, 120_000);
});
