// @vitest-environment jsdom
import { describe, expect, it, afterEach, beforeEach, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { z } from 'zod';
import { usePluginConfig } from '../usePluginConfig';

/**
 * Транспорт мокається на рівні серверної поверхні (рішення B9): у браузері
 * клієнта до БД більше немає, тож двійника PostgREST тут теж більше немає.
 */

const schema = z.object({
  maxVisible: z.number().int().default(5),
  badge: z.string().default('new'),
});

let stored: { found: boolean; config: unknown } = { found: true, config: {} };
let readError: Error | null = null;
let writeAllowed = true;
const written: Record<string, unknown>[] = [];

vi.mock('simplycms/plugin-sdk/server', () => ({
  pluginConfigRead: async () => {
    if (readError) throw readError;
    return stored;
  },
  pluginConfigWrite: async ({
    data,
  }: {
    data: { config: Record<string, unknown> };
  }) => {
    if (!writeAllowed) return false;
    written.push(data.config);
    return true;
  },
}));

beforeEach(() => {
  stored = { found: true, config: {} };
  readError = null;
  writeAllowed = true;
  written.length = 0;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('usePluginConfig', () => {
  it('віддає збережений конфіг, доповнений дефолтами схеми', async () => {
    stored = { found: true, config: { maxVisible: 12 } };
    const { result } = renderHook(() => usePluginConfig('faq', schema));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.config).toEqual({ maxVisible: 12, badge: 'new' });
  });

  it('порожній конфіг → чисті дефолти', async () => {
    const { result } = renderHook(() => usePluginConfig('faq', schema));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.config).toEqual({ maxVisible: 5, badge: 'new' });
  });

  it('рядка плагіна немає → дефолти + попередження про розсинхрон', async () => {
    stored = { found: false, config: {} };
    const { result } = renderHook(() => usePluginConfig('faq', schema));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.config).toEqual({ maxVisible: 5, badge: 'new' });
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('рядка plugins'),
    );
  });

  it('битий конфіг → дефолти замість падіння', async () => {
    stored = { found: true, config: { maxVisible: 'багато' } };
    const { result } = renderHook(() => usePluginConfig('faq', schema));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.config).toEqual({ maxVisible: 5, badge: 'new' });
  });

  it('відмова сервера в читанні → дефолти, не падіння', async () => {
    readError = new Error('database is down');
    const { result } = renderHook(() => usePluginConfig('faq', schema));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.config).toEqual({ maxVisible: 5, badge: 'new' });
  });

  it('save валідує схемою ДО запиту й оновлює локальне значення', async () => {
    const { result } = renderHook(() => usePluginConfig('faq', schema));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      result.current.save({ maxVisible: 'ні' } as never),
    ).resolves.toBe(false);
    expect(written).toHaveLength(0);

    await expect(result.current.save({ maxVisible: 9 })).resolves.toBe(true);
    expect(written).toEqual([{ maxVisible: 9, badge: 'new' }]);
    await waitFor(() =>
      expect(result.current.config).toEqual({ maxVisible: 9, badge: 'new' }),
    );
  });

  it('сервер відмовив у праві → save віддає false, значення не змінюється', async () => {
    stored = { found: true, config: { maxVisible: 12 } };
    writeAllowed = false;
    const { result } = renderHook(() => usePluginConfig('faq', schema));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(result.current.save({ maxVisible: 1 })).resolves.toBe(false);
    expect(result.current.config).toEqual({ maxVisible: 12, badge: 'new' });
  });
});
