// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { describe, expect, it, afterEach } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { SupabaseProvider } from '@simplycms/supabase/SupabaseProvider';
import type { SupabaseClient } from '@simplycms/supabase/browser-client';
import { usePluginTable } from '../usePluginTable';

interface Call {
  table: string;
  op: string;
  args: unknown[];
}

/** Двійник ланцюжків supabase-js, які використовує порт; записує виклики. */
function makeClient(rows: Record<string, unknown>[]) {
  const calls: Call[] = [];
  const client = {
    from: (table: string) => ({
      select: () => {
        calls.push({ table, op: 'select', args: [] });
        const builder = {
          eq: (...args: unknown[]) => {
            calls.push({ table, op: 'eq', args });
            return builder;
          },
          order: (...args: unknown[]) => {
            calls.push({ table, op: 'order', args });
            return builder;
          },
          then: (resolve: (value: { data: unknown; error: null }) => unknown) =>
            resolve({ data: rows, error: null }),
        };
        return builder;
      },
      insert: (row: Record<string, unknown>) => ({
        select: () => ({
          single: () => {
            calls.push({ table, op: 'insert', args: [row] });
            return Promise.resolve({
              data: { id: 'new', ...row },
              error: null,
            });
          },
        }),
      }),
      update: (patch: Record<string, unknown>) => ({
        eq: (...args: unknown[]) => ({
          select: () => ({
            single: () => {
              calls.push({ table, op: 'update', args: [patch, ...args] });
              return Promise.resolve({
                data: { id: args[1], ...patch },
                error: null,
              });
            },
          }),
        }),
      }),
      delete: () => ({
        eq: (...args: unknown[]) => {
          calls.push({ table, op: 'delete', args });
          return Promise.resolve({ error: null });
        },
      }),
    }),
  } as unknown as SupabaseClient;
  return { client, calls };
}

const wrap =
  (client: SupabaseClient) =>
  ({ children }: { children: ReactNode }) => (
    <SupabaseProvider client={client}>{children}</SupabaseProvider>
  );

afterEach(cleanup);

describe('usePluginTable', () => {
  it('відмовляє таблиці без префікса plg_ (межа довіри)', () => {
    const { client } = makeClient([]);
    expect(() =>
      renderHook(() => usePluginTable('orders'), { wrapper: wrap(client) }),
    ).toThrow(/лише з власними/);
  });

  it('list проксить eq/order і віддає рядки', async () => {
    const { client, calls } = makeClient([{ id: '1', question: 'Що?' }]);
    const { result } = renderHook(() => usePluginTable('plg_faq_items'), {
      wrapper: wrap(client),
    });
    const rows = await result.current.list({
      eq: { is_active: true },
      orderBy: 'sort_order',
    });
    expect(rows).toEqual([{ id: '1', question: 'Що?' }]);
    expect(calls.map((c) => c.op)).toEqual(['select', 'eq', 'order']);
    expect(calls.every((c) => c.table === 'plg_faq_items')).toBe(true);
  });

  it('insert/update/remove проходять по id і повертають рядок', async () => {
    const { client, calls } = makeClient([]);
    const { result } = renderHook(() => usePluginTable('plg_faq_items'), {
      wrapper: wrap(client),
    });
    await expect(result.current.insert({ question: 'A' })).resolves.toEqual({
      id: 'new',
      question: 'A',
    });
    await expect(
      result.current.update('42', { question: 'B' }),
    ).resolves.toEqual({ id: '42', question: 'B' });
    await result.current.remove('42');
    expect(calls.map((c) => c.op)).toEqual(['insert', 'update', 'delete']);
  });

  it('помилка PostgREST — виняток із назвою операції', async () => {
    const client = {
      from: (table: string) => ({
        select: () => ({
          eq: () => ({}),
          order: () => ({}),
          then: (
            resolve: (value: {
              data: null;
              error: { message: string };
            }) => unknown,
          ) => resolve({ data: null, error: { message: `RLS: ${table}` } }),
        }),
      }),
    } as unknown as SupabaseClient;
    const { result } = renderHook(() => usePluginTable('plg_faq_items'), {
      wrapper: wrap(client),
    });
    await expect(result.current.list()).rejects.toThrow(
      /list plg_faq_items: RLS/,
    );
  });
});
