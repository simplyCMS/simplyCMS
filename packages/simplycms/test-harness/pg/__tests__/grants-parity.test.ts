// Гейт парності привілеїв (Task 4, план В2-К1а).
//
// 🔴 Що саме він закриває. Живий аудит 2026-08-23 знайшов у репо НУЛЬ
// GRANT-ів: уся привілейна поверхня прода (280 табличних грантів × 2 ролі +
// EXECUTE на 13 SECDEF-функціях) була неявним дефолтом платформи Supabase —
// поза ревʼю і поза будь-яким гейтом. Тут вона стає вимірюваною: фактичний
// ACL чистої БД звіряється з декларацією `fixtures/grants.ts`. Нова таблиця
// без гранта, зайвий грант, `GRANT … TO PUBLIC`, право в `app_runtime` —
// кожне з цього червонить файл.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveHarness } from '../up.mjs';
import {
  applySqlFiles,
  createTempDatabase,
  dropTempDatabase,
  queryInTransaction,
  randomDbName,
  withDbName,
  withUser,
} from '../apply.mjs';
import {
  columnGrants,
  functionGrants,
  policyCommands,
  sequenceNames,
  tableGrants,
} from '../introspect.mjs';
import {
  COLUMN_GRANTS,
  expectedGrantMatrix,
  GRANTED_ROLES,
} from './fixtures/grants';

const CANON_DIR = join(import.meta.dirname, '../../../migrations');

/** Таблиці з увімкненим RLS — на них гранти мусять збігатися з політиками. */
const RLS_TABLES = [
  'comparisons',
  'order_items',
  'orders',
  'product_reviews',
  'profiles',
  'user_addresses',
  'user_category_history',
  'user_recipients',
  'user_roles',
  'wishlists',
];

type Matrix = Record<string, Record<string, string[]>>;
type ColumnMatrix = Record<string, Record<string, Record<string, string[]>>>;

describe('парність привілеїв: baseline v2', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_grants');
  let dbUrl: string;
  let actual: Matrix;
  let actualColumns: ColumnMatrix;

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applySqlFiles(
      dbUrl,
      readdirSync(CANON_DIR)
        .filter((name) => name.endsWith('.sql'))
        .sort()
        .map((name) => join(CANON_DIR, name)),
    );
    // Власника таблиць фільтруємо: у різних оточеннях він зветься по-різному
    // (`postgres`, `pgtest`, роль деплою) і до контракту не належить.
    actual = (await tableGrants(dbUrl, [
      ...GRANTED_ROLES,
      'app_runtime',
      'PUBLIC',
    ])) as Matrix;
    actualColumns = (await columnGrants(dbUrl, [
      ...GRANTED_ROLES,
      'app_runtime',
      'PUBLIC',
    ])) as ColumnMatrix;
  }, 120_000);

  afterAll(async () => {
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  it('табличні гранти збігаються з декларацією репо', () => {
    expect(actual).toEqual(expectedGrantMatrix());
  });

  it('Е6в-24: колонкові гранти збігаються з декларацією репо', () => {
    // Колонкове право — окремий зріз (`pg_attribute.attacl`): табличний гейт
    // вище його не бачить, тож без цього асерта зайва колонка в гранті
    // (напр. `category_id`) пройшла б мовчки.
    expect(actualColumns).toEqual(COLUMN_GRANTS);
  });

  it('жодного гранта ролі PUBLIC і ролі app_runtime', () => {
    // Обидва — режими тихої відмови. PUBLIC роздає права мовчки кожному, а
    // право в `app_runtime` зняло б fail-closed: забутий `SET LOCAL ROLE`
    // почав би тихо працювати повз RLS.
    const offenders = [actual, actualColumns].flatMap((matrix) =>
      Object.entries(matrix).flatMap(([table, roles]) =>
        Object.keys(roles)
          .filter((role) => role === 'PUBLIC' || role === 'app_runtime')
          .map((role) => `${table}:${role}`),
      ),
    );
    expect(offenders).toEqual([]);
  });

  it('гранти RLS-таблиць дорівнюють командам політик тієї ж ролі', async () => {
    // Розходження означає або мертвий привілей (право є, політики немає),
    // або мертву політику (політика є, права немає) — обидва стани брехливі.
    // Команда, видана лише на частину колонок (Е6в-24), — теж команда ролі:
    // політика UPDATE без колонкового UPDATE (і навпаки) так само брехлива.
    const policies = (await policyCommands(dbUrl)) as Matrix;
    const cmdsOf = (table: string, role: string) =>
      [
        ...new Set([
          ...(actual[table]?.[role] ?? []),
          ...Object.keys(actualColumns[table]?.[role] ?? {}),
        ]),
      ].sort();
    for (const table of RLS_TABLES)
      for (const role of GRANTED_ROLES)
        expect({ table, role, cmds: cmdsOf(table, role) }).toEqual({
          table,
          role,
          cmds: policies[table]?.[role] ?? [],
        });
  });

  it('функції: лише читач GUC, без SECDEF і без EXECUTE у PUBLIC', async () => {
    const rows = (await functionGrants(dbUrl)) as {
      function_name: string;
      security_definer: boolean;
      role_name: string | null;
      privilege: string | null;
    }[];
    // Baseline v2 не везе жодної бізнес-функції — саме тому клас дірок
    // «unguarded SECURITY DEFINER» у ньому структурно відсутній.
    expect([...new Set(rows.map((r) => r.function_name))]).toEqual([
      'app.current_user_id',
    ]);
    expect(rows.every((r) => r.security_definer === false)).toBe(true);
    expect(rows.some((r) => r.role_name === 'PUBLIC')).toBe(false);
    const executors = rows
      .filter(
        (r) => r.privilege === 'EXECUTE' && r.role_name?.startsWith('app'),
      )
      .map((r) => r.role_name)
      .sort();
    expect(executors).toEqual(['app_admin', 'app_runtime', 'app_user']);
  });

  it('сиквенсів у baseline немає — порожній блок грантів на них правдивий', async () => {
    // Якщо сиквенс колись зʼявиться, а гранта на нього — ні, INSERT під
    // `app_user` впаде в рантаймі. Гейт мусить це впіймати раніше.
    expect(await sequenceNames(dbUrl)).toEqual([]);
  });

  describe('fail-closed: app_runtime без SET LOCAL ROLE', () => {
    let runtimeUrl: string;
    beforeAll(() => {
      runtimeUrl = withUser(dbUrl, 'app_runtime');
    });

    it('SELECT доменної таблиці падає з permission denied', async () => {
      // 🔴 Головний доказ дизайну: забутий `SET LOCAL ROLE` дає ВІДМОВУ, а не
      // тихий обхід RLS. Без цієї перевірки решта гейта не доводить головного.
      await expect(
        queryInTransaction(runtimeUrl, ['select 1 from public.products']),
      ).rejects.toThrow(/permission denied/i);
    });

    it('той самий SELECT після SET LOCAL ROLE app_user проходить', async () => {
      // Позитивний контроль до негативного: доводить, що відмова вище — саме
      // про відсутнє перемикання ролі, а не про конект чи схему.
      await expect(
        queryInTransaction(runtimeUrl, [
          'set local role app_user',
          'select 1 from public.products',
        ]),
      ).resolves.toEqual([]);
    });

    it('таблиці Better Auth недосяжні навіть під app_user', async () => {
      await expect(
        queryInTransaction(runtimeUrl, [
          'set local role app_user',
          'select 1 from public.sessions',
        ]),
      ).rejects.toThrow(/permission denied/i);
    });
  });
});
