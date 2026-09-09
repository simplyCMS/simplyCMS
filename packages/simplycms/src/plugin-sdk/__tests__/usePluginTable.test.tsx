// @vitest-environment jsdom
import { describe, expect, it, afterEach, beforeEach, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { usePluginTable } from '../usePluginTable';

/**
 * Юніт порту: що саме хук кладе в запит до серверної поверхні.
 *
 * 🔴 Межу даних (`plg_<плагін>_*` і тільки її) цей файл НЕ доводить і не
 * може: після рішення B9 рішення ухвалює сервер (`plugin-sdk/server/guard`),
 * а хук лише передає імена. Доводять її юніт гарда й гейт `pnpm test:schema`
 * проти живої БД — там плагін реально не дістає таблицю ядра.
 */

interface Call {
  op: string;
  data: Record<string, unknown>;
}

const calls: Call[] = [];
let listRows: Record<string, unknown>[] = [];
let listError: Error | null = null;

vi.mock('simplycms/plugin-sdk/server', () => ({
  pluginTableList: async ({ data }: { data: Record<string, unknown> }) => {
    calls.push({ op: 'list', data });
    if (listError) throw listError;
    return listRows;
  },
  pluginTableInsert: async ({ data }: { data: Record<string, unknown> }) => {
    calls.push({ op: 'insert', data });
    return { id: 'new', ...(data.row as Record<string, unknown>) };
  },
  pluginTableUpdate: async ({ data }: { data: Record<string, unknown> }) => {
    calls.push({ op: 'update', data });
    return { id: data.id, ...(data.patch as Record<string, unknown>) };
  },
  pluginTableRemove: async ({ data }: { data: Record<string, unknown> }) => {
    calls.push({ op: 'remove', data });
  },
}));

beforeEach(() => {
  calls.length = 0;
  listRows = [];
  listError = null;
});

afterEach(cleanup);

describe('usePluginTable', () => {
  it('list передає імʼя плагіна, таблицю й фільтри — і віддає рядки', async () => {
    listRows = [{ id: '1', question: 'Що?' }];
    const { result } = renderHook(() => usePluginTable('faq', 'plg_faq_items'));

    const rows = await result.current.list({
      eq: { is_active: true },
      orderBy: 'sort_order',
    });

    expect(rows).toEqual([{ id: '1', question: 'Що?' }]);
    expect(calls).toEqual([
      {
        op: 'list',
        data: {
          plugin: 'faq',
          table: 'plg_faq_items',
          eq: { is_active: true },
          orderBy: 'sort_order',
          ascending: undefined,
        },
      },
    ]);
  });

  it('insert/update/remove проходять по id і повертають рядок', async () => {
    const { result } = renderHook(() => usePluginTable('faq', 'plg_faq_items'));

    await expect(
      result.current.insert({ id: 'new', question: 'A' }),
    ).resolves.toEqual({
      id: 'new',
      question: 'A',
    });
    await expect(
      result.current.update('42', { question: 'B' }),
    ).resolves.toEqual({ id: '42', question: 'B' });
    await result.current.remove('42');

    expect(calls.map((call) => call.op)).toEqual([
      'insert',
      'update',
      'remove',
    ]);
    expect(calls.every((call) => call.data.plugin === 'faq')).toBe(true);
  });

  it('undefined у рядку їде як null — транспорт бере лише JSON-скаляри', async () => {
    const { result } = renderHook(() => usePluginTable('faq', 'plg_faq_items'));

    await result.current.insert({
      id: 'new',
      question: 'A',
      product_id: undefined,
    });

    expect(calls[0].data.row).toEqual({
      id: 'new',
      question: 'A',
      product_id: null,
    });
  });

  it('помилка сервера доїжджає до викликача, а не ковтається', async () => {
    const { result } = renderHook(() => usePluginTable('faq', 'plg_faq_items'));
    listError = new Error(
      '[plugin-sdk] Плагін "faq" не володіє таблицею "orders"',
    );

    await expect(result.current.list()).rejects.toThrow(/не володіє таблицею/);
  });
});
