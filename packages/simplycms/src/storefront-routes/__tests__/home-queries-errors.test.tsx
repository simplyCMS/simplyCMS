// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  useFeaturedProducts,
  useNewProducts,
  useRootSections,
  useSectionProducts,
} from '../pages/home/queries';

/**
 * Task 0.1: помилка Supabase (RLS violation тощо) не повинна ковтатись —
 * хук має перейти в isError, а не віддати isSuccess з порожнім масивом.
 */

/** Thenable-білдер, що на будь-який виклик ланцюга повертає задану помилку. */
function createFailingSupabase() {
  const result = { data: null, error: { message: 'RLS violation' } };
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = chain;
  builder.eq = chain;
  builder.is = chain;
  builder.order = chain;
  builder.limit = chain;
  builder.then = <TResult,>(onfulfilled: (value: typeof result) => TResult) =>
    Promise.resolve(result).then(onfulfilled);

  return {
    from: () => builder,
  };
}

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const mockSupabase = createFailingSupabase();

vi.mock('simplycms/supabase/SupabaseProvider', () => ({
  useSupabaseClient: () => mockSupabase,
}));

describe('home/queries — помилки Supabase не ковтаються', () => {
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
