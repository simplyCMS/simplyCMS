// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { describe, expect, it, afterEach } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { z } from 'zod';
import { SupabaseProvider } from 'simplycms/supabase/SupabaseProvider';
import type { SupabaseClient } from 'simplycms/supabase/browser-client';
import { usePluginConfig } from '../usePluginConfig';

const schema = z.object({
  maxVisible: z.number().int().default(5),
  badge: z.string().default('new'),
});

function makeClient(config: unknown, error: { message: string } | null = null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: error ? null : { config },
              error,
            }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

const wrap =
  (client: SupabaseClient) =>
  ({ children }: { children: ReactNode }) => (
    <SupabaseProvider client={client}>{children}</SupabaseProvider>
  );

afterEach(cleanup);

describe('usePluginConfig', () => {
  it('віддає збережений конфіг, доповнений дефолтами схеми', async () => {
    const { result } = renderHook(() => usePluginConfig('faq', schema), {
      wrapper: wrap(makeClient({ maxVisible: 12 })),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.config).toEqual({ maxVisible: 12, badge: 'new' });
  });

  it('порожній рядок БД → чисті дефолти', async () => {
    const { result } = renderHook(() => usePluginConfig('faq', schema), {
      wrapper: wrap(makeClient(null)),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.config).toEqual({ maxVisible: 5, badge: 'new' });
  });

  it('битий конфіг → дефолти замість падіння', async () => {
    const { result } = renderHook(() => usePluginConfig('faq', schema), {
      wrapper: wrap(makeClient({ maxVisible: 'багато' })),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.config).toEqual({ maxVisible: 5, badge: 'new' });
  });
});
