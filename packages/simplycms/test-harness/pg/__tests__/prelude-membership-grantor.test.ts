// Фінальне рев'ю М1, раунд 4 (R3-3): прелюдія перевидає членство `app_runtime` лише коли
// ВЛАСНОГО (свого грантора) правильного рядка немає. Чуже членство з INHERIT вона виправити не
// може, тож і не перевидає своє щоразу; власний рядок з INHERIT — виправляє.
// Заміряно: тотожний повторний `grant` рядка не пише (лише NOTICE «already been granted»), тож
// доказ «не перевидає» — відсутність цього NOTICE, а «не пише» — незмінний `xmin`.
//
// 🔴 Ролі кластерні, а харнес спільний: чуже INHERIT-членство справжньої `app_runtime` зняло б
// fail-closed сусіднім файлам і прогонам. Тому прелюдія котиться з ролями під унікальними
// іменами (той самий текст канону, лише імена ролей замінено) — справжні `app_*` не чіпаємо.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as H from '../apply.mjs';
import { resolveHarness } from '../up.mjs';

const PRELUDE = readFileSync(join(H.CANON_DIR, '0000_prelude.sql'), 'utf8');

describe('прелюдія: перевидання членства лише за відсутності власного рядка', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const prefix = H.randomDbName('r33');
  const role = (r: 'runtime' | 'user' | 'admin' | 'other') => `${prefix}_${r}`;
  const db = H.randomDbName('simplycms_prelude_grantor');
  let dbUrl = '';
  const prelude = PRELUDE.replace(
    /\bapp_(runtime|user|admin)\b/g,
    (_, r: string) => `${prefix}_${r}`,
  );
  /** Накат прелюдії; повертає NOTICE сервера (тотожний повторний `grant` дає саме його). */
  const apply = async () => {
    const client = new pg.Client({ connectionString: dbUrl });
    const notices: string[] = [];
    client.on('notice', (n) => notices.push(n.message ?? ''));
    await client.connect();
    try {
      await client.query(prelude);
    } finally {
      await client.end();
    }
    return notices;
  };
  const memberships = async () =>
    (await H.queryRows(
      harness.url,
      `select roleid::regrole::text as role, grantor::regrole::text as grantor,
              inherit_option, set_option, xmin::text as xmin
         from pg_auth_members where member = $1::regrole
        order by role, grantor`,
      [role('runtime')],
    )) as {
      role: string;
      grantor: string;
      inherit_option: boolean;
      xmin: string;
    }[];

  beforeAll(async () => {
    harness = await resolveHarness();
    await H.createTempDatabase(harness.url, db);
    dbUrl = H.withDbName(harness.url, db);
    await apply();
  });

  afterAll(async () => {
    await H.dropTempDatabase(harness.url, db);
    for (const r of ['runtime', 'user', 'admin', 'other'] as const)
      await H.queryRows(harness.url, `drop role if exists ${role(r)}`);
    await harness?.teardown();
  });

  it('чуже INHERIT-членство + своє правильне → повторний накат не перевидає й не пише в pg_auth_members', async () => {
    await H.queryRows(harness.url, `create role ${role('other')}`);
    await H.queryRows(
      harness.url,
      `grant ${role('user')} to ${role('other')} with admin option`,
    );
    await H.queryRows(
      harness.url,
      `grant ${role('user')} to ${role('runtime')} with inherit true, set false granted by ${role('other')}`,
    );
    const before = await memberships();
    // Передумова: у `user` два рядки — свій (правильний) і чужий з INHERIT.
    expect(
      before
        .filter((m) => m.role === role('user'))
        .map((m) => m.inherit_option),
    ).toEqual(expect.arrayContaining([true, false]));
    const notices = await apply();
    expect(notices.filter((n) => /already been granted/.test(n))).toEqual([]);
    expect(await memberships()).toEqual(before);
  });

  it('власний рядок з INHERIT поруч із чужим правильним → прелюдія виправляє власний', async () => {
    // Чужий правильний рядок не має приховати власний з INHERIT: умова — саме СВІЙ грантор.
    await H.queryRows(
      harness.url,
      `grant ${role('admin')} to ${role('other')} with admin option`,
    );
    await H.queryRows(
      harness.url,
      `grant ${role('admin')} to ${role('runtime')} with inherit false, set true granted by ${role('other')}`,
    );
    // Грант суперкористувача — той самий грантор, що й у прелюдії: це її власний рядок.
    await H.queryRows(
      harness.url,
      `grant ${role('admin')} to ${role('runtime')} with inherit true`,
    );
    await apply();
    const rows = (await memberships()).filter((m) => m.role === role('admin'));
    expect(
      rows.map((m) => [m.grantor === role('other'), m.inherit_option]),
    ).toEqual(
      expect.arrayContaining([
        [true, false],
        [false, false],
      ]),
    );
    expect(rows).toHaveLength(2);
  });
});
