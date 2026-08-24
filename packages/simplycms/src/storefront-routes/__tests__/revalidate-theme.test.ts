import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getTableName, type SQL, type Table } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { Actor } from 'simplycms/db';

/**
 * POST `/api/revalidate-theme` — auth-guarded скидання серверного кешу
 * активної теми.
 *
 * Перевіряємо і guard (без сесії / не-адмін → 403), і фактичний ефект:
 * після 200 наступне читання теми має піти в БД, а не віддати кешований запис.
 *
 * 🔴 Мокається `simplycms/db`, тобто ЄДИНИЙ канал до Postgres. Це дає тесту
 * те, чого мок supabase-клієнта дати не міг: видно і РОЛЬ актора кожної
 * транзакції, і точний предикат запиту — а обидва є частиною контракту
 * (публічне читання лише під `app_user`, guard лише по своїх рядках).
 */

/** Керований стан: хто «залогінений» (сесія Better Auth) і чи має роль admin. */
let currentUser: { id: string } | null = null;
let hasAdminRole = false;
/** Скільки разів читання активної теми реально ходило в БД. */
let themeQueries = 0;

/** Протокол транзакцій: актор + таблиця + скомпільований предикат. */
interface RecordedQuery {
  actor: Actor;
  table: string;
  sql: string;
  params: unknown[];
}
const queries: RecordedQuery[] = [];

const ADMIN_USER = '11111111-1111-4111-8111-111111111111';
const dialect = new PgDialect();

/** Рядки, які «віддає» БД на запит до конкретної таблиці. */
function rowsFor(table: string): unknown[] {
  if (table === 'themes') {
    themeQueries += 1;
    return [
      {
        id: 'theme-1',
        name: `theme-${themeQueries}`,
        display_name: 'Тема',
        version: '1.0.0',
        description: null,
        author: null,
        preview_image: null,
        is_active: true,
        settings: {},
        created_at: '2026-07-31T00:00:00.000Z',
        updated_at: '2026-07-31T00:00:00.000Z',
      },
    ];
  }
  if (table === 'user_roles') return hasAdminRole ? [{ role: 'admin' }] : [];
  return [];
}

/** Мінімальний drizzle-подібний білдер: записує запит і віддає рядки. */
function makeDb(actor: Actor): unknown {
  return {
    select: () => ({
      from: (table: Table) => {
        const query: RecordedQuery = {
          actor,
          table: getTableName(table),
          sql: '',
          params: [],
        };
        const builder = {
          where(condition: SQL) {
            const compiled = dialect.sqlToQuery(condition);
            query.sql = compiled.sql;
            query.params = compiled.params;
            return builder;
          },
          limit: () => builder,
          orderBy: () => builder,
          then<T>(resolve: (rows: unknown[]) => T) {
            queries.push(query);
            return Promise.resolve(rowsFor(query.table)).then(resolve);
          },
        };
        return builder;
      },
    }),
  };
}

vi.mock('simplycms/db', () => ({
  withActor: (actor: Actor, fn: (db: unknown) => Promise<unknown>) =>
    fn(makeDb(actor)),
}));

// Ідентичність підміняється на рівні ІНСТАНСУ Better Auth, а не всього
// `simplycms/auth`: `readUserRoles` мусить лишитись справжнім — саме він
// ходить у `withActor`, і саме його актора й предикат тест міряє нижче.
// 🔴 Шлях ВІДНОСНИЙ, а не `simplycms/auth/instance`: субшляху `auth/instance`
// в `exports` пакета немає (і не буде — межа довіри), а `audit-exports`
// сканує саме bare-специфікатори й червонів би на неіснуючому ключі.
vi.mock('../../auth/instance', () => ({
  getAuth: () => ({
    api: {
      getSession: async () =>
        currentUser
          ? { user: { id: currentUser.id, email: 'admin@example.test' } }
          : null,
    },
  }),
}));

// Запит із ALS у тесті немає — віддаємо порожній: cookie все одно читає мок
// сесії вище.
vi.mock('@tanstack/react-start/server', () => ({
  getRequest: () => new Request('http://shop.test/api/revalidate-theme'),
}));

import { revalidateTheme } from '../server/revalidate-theme';
import { invalidateThemeCache, loadActiveTheme } from '../server/theme-record';

beforeEach(() => {
  currentUser = null;
  hasAdminRole = false;
  themeQueries = 0;
  queries.length = 0;
  invalidateThemeCache();
});

describe('POST /api/revalidate-theme', () => {
  it('без сесії → 403 і кеш не чіпається', async () => {
    await loadActiveTheme();
    expect(themeQueries).toBe(1);

    const response = await revalidateTheme();

    expect(response.status).toBe(403);
    await loadActiveTheme();
    expect(themeQueries).toBe(1);
  });

  it('користувач без ролі admin → 403 і кеш не чіпається', async () => {
    currentUser = { id: ADMIN_USER };
    await loadActiveTheme();

    const response = await revalidateTheme();

    expect(response.status).toBe(403);
    await loadActiveTheme();
    expect(themeQueries).toBe(1);
  });

  it('адмін → 200 і наступне читання теми йде в БД, а не з кешу', async () => {
    currentUser = { id: ADMIN_USER };
    hasAdminRole = true;

    const first = await loadActiveTheme();
    expect(themeQueries).toBe(1);
    // Контроль: без інвалідації повторне читання лишається кешованим.
    expect(await loadActiveTheme()).toBe(first);
    expect(themeQueries).toBe(1);

    const response = await revalidateTheme();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ revalidated: true });

    const afterInvalidation = await loadActiveTheme();
    expect(themeQueries).toBe(2);
    expect(afterInvalidation?.name).toBe('theme-2');
  });

  it('guard читає РІВНО user_roles з предикатами user_id + role=admin', async () => {
    currentUser = { id: ADMIN_USER };
    hasAdminRole = true;

    await revalidateTheme();

    const guard = queries.filter((q) => q.table === 'user_roles');
    expect(guard).toHaveLength(1);
    // 🔴 Предикат — рівно `user_id`, без `role = 'admin'`: контур читає ВСІ
    // ролі субʼєкта (їх максимум дві), а рішення ухвалює TS-матриця authz.
    // Фільтр по ролі в SQL повернув би відповідь на питання «чи я адмін» ще
    // до того, як його задали, і зробив би решту ролей невидимими.
    expect(guard[0].params).toEqual([ADMIN_USER]);
    expect(guard[0].sql).toContain('"user_id"');
  });

  it('читання вітрини йде під app_user БЕЗ userId, а guard — зі своїм userId', async () => {
    currentUser = { id: ADMIN_USER };
    hasAdminRole = true;

    await loadActiveTheme();
    await revalidateTheme();

    const themeQuery = queries.find((q) => q.table === 'themes');
    const guardQuery = queries.find((q) => q.table === 'user_roles');

    // Публічне читання не має підвищених прав — інакше вітрина бачила б усе.
    expect(themeQuery?.actor).toEqual({ role: 'app_user' });
    expect(guardQuery?.actor).toEqual({
      role: 'app_user',
      userId: ADMIN_USER,
    });
  });
});
