import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Task 4.1: POST `/api/revalidate-theme` — auth-guarded скидання серверного
 * кешу активної теми (замість мертвого POST на `/api/revalidate`).
 *
 * Перевіряємо і guard (без сесії / не-адмін → 403), і фактичний ефект:
 * після 200 наступне читання теми має піти в БД, а не віддати кешований запис.
 */

/** Керований стан моків: хто «залогінений» і чи має роль admin */
let currentUser: { id: string } | null = null;
let hasAdminRole = false;
/** Скільки разів читання активної теми реально ходило в БД */
let themeQueries = 0;
/**
 * Протокол запитів guard-а: таблиця + УСІ предикати `eq`. Без нього підміна
 * `user_roles`→`profiles` чи `role:'admin'`→`'customer'` лишається безкарною.
 */
const adminQueries: { table: string; eq: Record<string, unknown> }[] = [];

interface AdminQueryBuilder {
  select: () => AdminQueryBuilder;
  eq: (column: string, value: unknown) => AdminQueryBuilder;
  maybeSingle: () => Promise<{ data: { role: string } | null; error: null }>;
}

vi.mock('simplycms/supabase/server-client', () => ({
  createServerSupabase: () => ({
    auth: {
      getUser: async () => ({ data: { user: currentUser }, error: null }),
    },
    from: (table: string) => {
      const query = { table, eq: {} as Record<string, unknown> };
      adminQueries.push(query);
      const builder: AdminQueryBuilder = {
        select: () => builder,
        eq: (column, value) => {
          query.eq[column] = value;
          return builder;
        },
        maybeSingle: async () => ({
          data: hasAdminRole ? { role: 'admin' } : null,
          error: null,
        }),
      };
      return builder;
    },
  }),
}));

vi.mock('simplycms/supabase/anon-client', () => ({
  createAnonSupabaseClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => {
            themeQueries += 1;
            return {
              data: {
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
              error: null,
            };
          },
        }),
      }),
    }),
  }),
}));

import { revalidateTheme } from '../server/revalidate-theme';
import {
  invalidateThemeCache,
  loadActiveTheme,
} from '@simplycms/storefront-routes/server/themes';

beforeEach(() => {
  currentUser = null;
  hasAdminRole = false;
  themeQueries = 0;
  adminQueries.length = 0;
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
    currentUser = { id: 'user-1' };
    await loadActiveTheme();
    expect(themeQueries).toBe(1);

    const response = await revalidateTheme();

    expect(response.status).toBe(403);
    await loadActiveTheme();
    expect(themeQueries).toBe(1);
  });

  it('адмін → 200 і наступне читання теми йде в БД, а не з кешу', async () => {
    currentUser = { id: 'admin-1' };
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
    currentUser = { id: 'admin-1' };
    hasAdminRole = true;

    await revalidateTheme();

    expect(adminQueries).toEqual([
      { table: 'user_roles', eq: { user_id: 'admin-1', role: 'admin' } },
    ]);
  });
});
