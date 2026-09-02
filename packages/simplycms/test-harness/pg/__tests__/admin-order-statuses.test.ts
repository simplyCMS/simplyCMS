// Е1б, Task 8: інтеграційні тести трьох іменованих операцій order_statuses
// проти живої БД. Шапка — патерн aggregate-deps.test.ts (createTempDatabase
// → канон → app_runtime → afterAll із closeDbPool() ПЕРШИМ).
//
// 🔴 serverFn тут НЕ викликаються (getRequest() без ALS-контексту падає) —
// requireGrant мокається модульно, а операції беруться напряму зі
// службового server-only субшляху `simplycms/admin-server/impl` (легальний
// у тестах харнеса; клієнтський код його не імпортує НІКОЛИ — Gate C
// стереже це payload-маркером).
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { closeDbPool } from 'simplycms/db';
import { resolveHarness } from '../up.mjs';
import {
  applySqlFiles,
  createTempDatabase,
  dropTempDatabase,
  queryRows,
  randomDbName,
  withDbName,
  withUser,
} from '../apply.mjs';

// 🔴 Мок ОГОЛОШУЄТЬСЯ до імпортів операцій — vitest hoist-ить `vi.mock` над
// усіма імпортами модуля, тож порядок рядків тут не грає ролі, але порядок
// СЕКЦІЙ («мок» → «операції») лишається явним для читача.
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: null, roles: ['admin'] },
    scope: 'any',
  })),
}));

import {
  orderStatusesOps,
  setDefaultOrderStatusOp,
  reorderOrderStatusOp,
  removeManyOrderStatusesOp,
} from 'simplycms/admin-server/impl';

const MIGRATIONS = join(import.meta.dirname, '../../../migrations');

/** Канон у порядку імен — той самий список, що й у baseline.test.ts. */
const canonFiles = (): string[] =>
  readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => join(MIGRATIONS, name));

interface StatusRow {
  id: string;
  is_default: boolean;
}
interface SortRow {
  id: string;
  sort_order: number;
}

describe('order_statuses: операції проти живої БД (Е1б, Task 8)', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_admin_order_statuses');
  let dbUrl = '';

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    // 🔴 Канон уже сідить order_statuses (0003_seed.sql: 6 рядків, дефолт
    // 'new', sort_order 0..5) — demo-seed тут не потрібен.
    await applySqlFiles(dbUrl, canonFiles());
    // Як у всіх сусідніх тестах: app_runtime, і ЛИШЕ після сетапу канону.
    process.env.DATABASE_URL = withUser(dbUrl, 'app_runtime');
  }, 120_000);

  afterAll(async () => {
    await closeDbPool();
    delete process.env.DATABASE_URL;
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  it('setDefault переносить прапорець в одній транзакції', async () => {
    const before = (await queryRows(
      dbUrl,
      `select id, is_default from public.order_statuses order by sort_order`,
    )) as StatusRow[];
    const target = before.find((r) => !r.is_default)!;
    await setDefaultOrderStatusOp({ data: { id: target.id } });
    const after = (await queryRows(
      dbUrl,
      `select id, is_default from public.order_statuses`,
    )) as StatusRow[];
    expect(after.filter((r) => r.is_default)).toHaveLength(1);
    expect(after.find((r) => r.is_default)!.id).toBe(target.id);
  });

  it('setDefault на неіснуючий id — магазин НЕ лишається без дефолту', async () => {
    await expect(
      setDefaultOrderStatusOp({ data: { id: crypto.randomUUID() } }),
    ).rejects.toThrow();
    const after = (await queryRows(
      dbUrl,
      `select is_default from public.order_statuses`,
    )) as StatusRow[];
    expect(after.filter((r) => r.is_default)).toHaveLength(1);
  });

  it('reorder свапає сусідів; на краю — no-op', async () => {
    const list = (await queryRows(
      dbUrl,
      `select id, sort_order from public.order_statuses order by sort_order`,
    )) as SortRow[];
    await reorderOrderStatusOp({ data: { id: list[1].id, direction: 'up' } });
    const after = (await queryRows(
      dbUrl,
      `select id from public.order_statuses order by sort_order`,
    )) as { id: string }[];
    expect(after[0].id).toBe(list[1].id);
    const top = await reorderOrderStatusOp({
      data: { id: list[1].id, direction: 'up' },
    });
    expect(top.swapped).toHaveLength(0);
  });

  it('reorder: два зустрічні свопи суміжної пари — БЕЗ 40P01 (детермінований порядок локів)', async () => {
    // Фінальне рев'ю Е1б, знахідка 1: стара реалізація локала "current →
    // neighbor" ДВОМА окремими `SELECT … FOR UPDATE`. Для суміжної пари
    // (A, B) виклик reorder(A,'down') лока A, потім B; reorder(B,'up') —
    // у ЗУСТРІЧНОМУ порядку: B, потім A. Дві конкурентні транзакції з
    // круговим очікуванням локів — 40P01, відтворено двічі на живому
    // Postgres. Фікс бере обидва локи ОДНИМ `select … where id in (a,b)
    // order by id for update` — циклу очікування вже немає.
    const list = (await queryRows(
      dbUrl,
      `select id from public.order_statuses order by sort_order`,
    )) as { id: string }[];
    const [a, b] = [list[0].id, list[1].id];
    const results = await Promise.allSettled([
      reorderOrderStatusOp({ data: { id: a, direction: 'down' } }),
      reorderOrderStatusOp({ data: { id: b, direction: 'up' } }),
    ]);
    for (const r of results)
      expect(r.status, JSON.stringify(r)).toBe('fulfilled');
  });

  it('remove: batch [звичайний, дефолтний] — АТОМАРНА відмова, нічого не видалено', async () => {
    const rows = (await queryRows(
      dbUrl,
      `select id, is_default from public.order_statuses`,
    )) as StatusRow[];
    const def = rows.find((r) => r.is_default)!;
    const plain = rows.find((r) => !r.is_default)!;
    await expect(
      removeManyOrderStatusesOp({ data: [{ id: plain.id }, { id: def.id }] }),
    ).rejects.toThrow(/дефолтний/);
    const after = (await queryRows(
      dbUrl,
      `select id from public.order_statuses`,
    )) as { id: string }[];
    // Не видалений — rollback усього batch, включно з "невинним" plain.
    expect(after.map((r) => r.id)).toContain(plain.id);
    // Недефолтний окремо — ок.
    await removeManyOrderStatusesOp({ data: [{ id: plain.id }] });
    const afterSolo = (await queryRows(
      dbUrl,
      `select id from public.order_statuses`,
    )) as { id: string }[];
    expect(afterSolo.map((r) => r.id)).not.toContain(plain.id);
  });

  it('фабричний insert: batch масивом, id від клієнта, returning усі', async () => {
    const a = crypto.randomUUID();
    const b = crypto.randomUUID();
    const out = await orderStatusesOps.insert({
      data: [
        {
          id: a,
          name: 'Тест А',
          code: 'test-a',
          color: '#111111',
          sortOrder: 90,
        },
        {
          id: b,
          name: 'Тест Б',
          code: 'test-b',
          color: '#222222',
          sortOrder: 91,
        },
      ],
    });
    expect(out.map((r) => r.id).sort()).toEqual([a, b].sort());
  });

  it('list: defaultOrder застосовано без явного sorts', async () => {
    const rows = await orderStatusesOps.list({ data: {} });
    const orders = rows.map((r) => r.sortOrder);
    expect([...orders].sort((x, y) => x - y)).toEqual(orders);
  });
});
