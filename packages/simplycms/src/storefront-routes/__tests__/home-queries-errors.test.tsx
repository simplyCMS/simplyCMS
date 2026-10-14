// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  useFeaturedProducts,
  useNewProducts,
  useRootSections,
  useSectionProducts,
} from '../pages/home/queries';

// Авто-cleanup RTL у репо вимкнено (globals: false) — знімаємо дерево самі.
afterEach(cleanup);

/**
 * Task 0.1: помилка шару даних не повинна ковтатись — хук має перейти в
 * isError, а не віддати isSuccess з порожнім масивом.
 *
 * 🔴 Джерело помилки тепер СЕРВЕРНА функція, а не PostgREST-відповідь із
 * полем `error`: браузер у базу не ходить, тож збій приїжджає відхиленим
 * промісом виклику, і саме його хук мусить прокинути далі.
 */

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

// Р29: вид цін глядача — гість (без AuthProvider сесія вічно «в дорозі»).
vi.mock('simplycms/core/hooks/useViewerPriceKey', () => ({
  useViewerPriceKey: () => 'guest',
}));

vi.mock('../server/home', () => {
  const fail = () => Promise.reject(new Error('permission denied'));
  return {
    getHomePageData: fail,
    getFeaturedProducts: fail,
    getNewProducts: fail,
    getRootSections: fail,
    getSectionProducts: fail,
  };
});

describe('home/queries — помилки шару даних не ковтаються', () => {
  it('useFeaturedProducts переходить в isError', async () => {
    const { result } = renderHook(() => useFeaturedProducts(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('useNewProducts переходить в isError', async () => {
    const { result } = renderHook(() => useNewProducts(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('useRootSections переходить в isError', async () => {
    const { result } = renderHook(() => useRootSections(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('useSectionProducts переходить в isError', async () => {
    const { result } = renderHook(
      () => useSectionProducts({ id: 's1', name: 'S', slug: 's' }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
