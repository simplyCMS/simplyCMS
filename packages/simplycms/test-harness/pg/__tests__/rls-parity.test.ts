// Текстова парність RLS: накатаний канон ↔ `schema.ts` (Task 5, план В2-К1а).
//
// 🔴 Що саме тут замкнено. Старий `rls-parity` порівнював політики з фікстурою,
// знятою з ЖИВОЇ Supabase-БД: він ловив дрейф прода, але нічого не казав про
// baseline, бо baseline тоді не існувало. Тепер ланцюг інший і замкнений
// усередині репо: `schema.ts` (SSOT) → `0001_init.sql` (генерат drizzle-kit) →
// накатана БД. Розійтись вони можуть рівно в один спосіб — хтось правив схему
// й не перегенерував baseline. Саме це тут і червоніє.
//
// Поведінковий бік (хто які рядки бачить) — `rls-behaviour.test.ts`; ці два
// файли не дублюють один одного: текст політики може збігатися й при цьому
// пускати не тих, а поведінка може збігатися при розʼїханому baseline.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveHarness } from '../up.mjs';
import {
  applySqlFiles,
  createTempDatabase,
  dropTempDatabase,
  queryRows,
  randomDbName,
  withDbName,
} from '../apply.mjs';
import {
  livePolicies,
  normalizePredicates,
  rlsEnabledTables,
} from '../policies.mjs';
import { declaredPolicies, declaredRlsTables } from '../schema-policies';

const CANON_DIR = join(import.meta.dirname, '../../../migrations');

// 🔴 Пін мажора Postgres. Нормалізація предикатів робиться ТИМ САМИМ сервером,
// що й дамп (`policies.mjs`), тож форма виводу `pg_get_expr` між мажорами
// скорочується — але лише в межах мажорів, на яких збіг реально перевірено:
// 17 (CI-job `schema`) і 16 (харнес розробника, спайк 2026-08-23). Інший
// мажор має падати ОКРЕМИМ зрозумілим повідомленням, а не дифом політик, який
// нічого не пояснює.
const VERIFIED_MAJORS = [16, 17];

/** Форма рядка дампа `pg_policy` (помічники — `.mjs`, тож типи описані тут). */
interface LivePolicy {
  table: string;
  name: string;
  permissive: boolean;
  cmd: string;
  roles: string[];
  qual: string | null;
  withCheck: string | null;
}

describe('парність RLS: baseline ↔ schema.ts', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_rls_parity');
  let dbUrl: string;
  let major: number;
  let live: LivePolicy[];

  beforeAll(async () => {
    harness = await resolveHarness();
    const [version] = (await queryRows(
      harness.url,
      `select current_setting('server_version_num')::int as num,
              current_setting('server_version') as text`,
    )) as { num: number; text: string }[];
    major = Math.floor(version.num / 10_000);
    if (!VERIFIED_MAJORS.includes(major))
      throw new Error(
        `Гейт парності RLS розрахований на PostgreSQL ${VERIFIED_MAJORS.join(' або ')}, ` +
          `а харнес — ${version.text}. Форма виводу pg_get_expr між мажорами не ` +
          `гарантована, тож diff політик на цій версії нічого не доводив би. ` +
          `Підніміть харнес потрібного мажора або звірте нормалізацію на новому ` +
          `й додайте його до VERIFIED_MAJORS свідомо.`,
      );
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applySqlFiles(
      dbUrl,
      readdirSync(CANON_DIR)
        .filter((name) => name.endsWith('.sql'))
        .sort()
        .map((name) => join(CANON_DIR, name)),
    );
    live = (await livePolicies(dbUrl)) as LivePolicy[];
  }, 120_000);

  afterAll(async () => {
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  it('мажор харнеса — з переліку перевірених', () => {
    expect(VERIFIED_MAJORS).toContain(major);
  });

  it('склад політик збігається: таблиця, імʼя, команда, ролі, вид', () => {
    // Структурний зріз версіє-незалежний, тому звіряється текстом як є.
    const shape = (policy: {
      table: string;
      name: string;
      permissive: boolean;
      cmd: string;
      roles: string[];
    }) =>
      `${policy.table}.${policy.name} ${policy.permissive ? 'PERMISSIVE' : 'RESTRICTIVE'} ` +
      `${policy.cmd} TO ${policy.roles.join(',')}`;
    expect(live.map(shape)).toEqual(declaredPolicies().map(shape));
  });

  it('RLS увімкнено рівно на таблицях, що мають політики', async () => {
    // Розходження — тихий режим відмови в обидва боки: таблиця з політиками
    // без RLS віддає ВСЕ, таблиця з RLS без політик — НІЧОГО.
    expect(await rlsEnabledTables(dbUrl)).toEqual(declaredRlsTables());
  });

  it('предикати збігаються після нормалізації Postgres', async () => {
    const normalized = (await normalizePredicates(
      dbUrl,
      declaredPolicies(),
    )) as Pick<LivePolicy, 'table' | 'name' | 'qual' | 'withCheck'>[];
    const expected = Object.fromEntries(
      normalized.map((p) => [`${p.table}.${p.name}`, [p.qual, p.withCheck]]),
    );
    const actual = Object.fromEntries(
      live.map((p) => [`${p.table}.${p.name}`, [p.qual, p.withCheck]]),
    );
    expect(actual).toEqual(expected);
  }, 60_000);
});
