// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import { I18nProvider } from 'simplycms/i18n';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SupabaseProvider } from 'simplycms/supabase/SupabaseProvider';
import type { SupabaseClient } from 'simplycms/supabase/browser-client';
import { hookRegistry, registerPluginModule } from 'simplycms/plugins';
import type { Plugin } from 'simplycms/plugins/types';
import { usePluginToggle, PLUGINS_QUERY_KEY } from '../hooks/usePluginToggle';

const HOOK = 'admin.dashboard.widgets';
const PLUGIN = 'toggle-demo';

registerPluginModule(PLUGIN, {
  register: (registry) => registry.register(HOOK, PLUGIN, () => null),
  unregister: (registry) => registry.unregister(HOOK, PLUGIN),
});

/** Двійник `supabase.from('plugins').update(...).eq(...)`. */
function makeSupabase(fails: boolean): SupabaseClient {
  const client = {
    from: () => ({
      update: () => ({
        eq: async () => (fails ? { error: { message: 'db down' } } : {}),
      }),
    }),
  };
  return client as unknown as SupabaseClient;
}

function makePlugin(isActive: boolean): Plugin {
  return {
    id: 'p1',
    name: PLUGIN,
    display_name: 'Toggle Demo',
    version: '1.0.0',
    description: null,
    author: null,
    is_active: isActive,
    config: {},
    hooks: [],
    migrations_applied: [],
    installed_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

function setup(fails: boolean, isActive: boolean) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  queryClient.setQueryData<Plugin[]>(PLUGINS_QUERY_KEY, [makePlugin(isActive)]);
  const supabase = makeSupabase(fails);

  // I18nProvider — як у проді (`__root.tsx` над усіма групами роутів,
  // включно з адмінкою): хук бере тексти toast-ів через `useT()`.
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <SupabaseProvider client={supabase}>
        <I18nProvider locale="uk">{children}</I18nProvider>
      </SupabaseProvider>
    </QueryClientProvider>
  );

  const view = renderHook(() => usePluginToggle(), { wrapper });
  const cached = () =>
    queryClient.getQueryData<Plugin[]>(PLUGINS_QUERY_KEY)?.[0].is_active;

  return { ...view, cached };
}

describe('usePluginToggle', () => {
  beforeEach(() => {
    hookRegistry.clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    hookRegistry.clear();
  });

  it('успішний activate: registry змінено, стан toggle увімкнено', async () => {
    const { result, cached } = setup(false, false);

    act(() => result.current.togglePlugin({ name: PLUGIN, activate: true }));

    await waitFor(() => expect(result.current.togglingPlugin).toBeNull());
    expect(hookRegistry.getPluginsForHook(HOOK)).toEqual([PLUGIN]);
    expect(cached()).toBe(true);
  });

  it('збій БД при activate: registry без змін, стан toggle відкочено', async () => {
    const { result, cached } = setup(true, false);

    act(() => result.current.togglePlugin({ name: PLUGIN, activate: true }));

    await waitFor(() => expect(result.current.togglingPlugin).toBeNull());
    expect(hookRegistry.getPluginsForHook(HOOK)).toEqual([]);
    expect(cached()).toBe(false);
  });

  it('збій БД при deactivate: хуки лишаються, стан toggle відкочено', async () => {
    hookRegistry.register(HOOK, PLUGIN, () => null);
    const { result, cached } = setup(true, true);

    act(() => result.current.togglePlugin({ name: PLUGIN, activate: false }));

    await waitFor(() => expect(result.current.togglingPlugin).toBeNull());
    expect(hookRegistry.getPluginsForHook(HOOK)).toEqual([PLUGIN]);
    expect(cached()).toBe(true);
  });
});
