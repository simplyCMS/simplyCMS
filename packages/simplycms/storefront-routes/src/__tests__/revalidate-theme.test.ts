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

vi.mock('@simplycms/supabase/server-client', () => ({
  createServerSupabase: () => ({
    auth: {
      getUser: async () => ({ data: { user: currentUser }, error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: hasAdminRole ? { role: 'admin' } : null,
              error: null,
            }),
          }),
        }),
      }),
    }),
  }),
}));

vi.mock('@simplycms/supabase/anon-client', () => ({
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

import { revalidateThemeHandler } from '../../routes/api/revalidate-theme';
import {
  invalidateThemeCache,
  loadActiveTheme,
} from '@simplycms/storefront-routes/server/themes';

beforeEach(() => {
  currentUser = null;
  hasAdminRole = false;
  themeQueries = 0;
  invalidateThemeCache();
});

describe('POST /api/revalidate-theme', () => {
  it('без сесії → 403 і кеш не чіпається', async () => {
    await loadActiveTheme();
    expect(themeQueries).toBe(1);

    const response = await revalidateThemeHandler();

    expect(response.status).toBe(403);
    await loadActiveTheme();
    expect(themeQueries).toBe(1);
  });

  it('користувач без ролі admin → 403 і кеш не чіпається', async () => {
    currentUser = { id: 'user-1' };
    await loadActiveTheme();
    expect(themeQueries).toBe(1);

    const response = await revalidateThemeHandler();

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

    const response = await revalidateThemeHandler();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ revalidated: true });

    const afterInvalidation = await loadActiveTheme();
    expect(themeQueries).toBe(2);
    expect(afterInvalidation?.name).toBe('theme-2');
  });
});
