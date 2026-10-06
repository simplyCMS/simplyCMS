// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { createTranslator } from 'simplycms/i18n';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';
import type { PluginRow } from 'simplycms/admin-server';
import { makeWrapper } from '../../settings/__tests__/render-support';
import { pluginRow } from './plugin-rows';

const { toastError, toastSuccess, sync, order } = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  sync: vi.fn(),
  order: [] as string[],
}));
vi.mock('sonner', () => ({
  toast: { error: toastError, success: toastSuccess },
}));
vi.mock('simplycms/plugins', async (importOriginal) => ({
  ...(await importOriginal<typeof import('simplycms/plugins')>()),
  syncPluginHooks: sync,
}));

const mocks = vi.hoisted(() => ({
  setPluginActive: vi.fn(),
  listPlugins: vi.fn(),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock(mocks),
);

import { usePluginToggle } from '../usePluginToggle';

const t = createTranslator('uk');
const KEY = entityKey(ENTITY.plugins).all();
let client: QueryClient;

const cached = () => client.getQueryData<PluginRow[]>(KEY)?.[0]?.isActive;

beforeEach(() => {
  vi.clearAllMocks();
  order.length = 0;
  client = new QueryClient();
  client.setQueryData<PluginRow[]>(KEY, [pluginRow('hello', false)]);
  mocks.setPluginActive.mockImplementation(async ({ data }) => {
    order.push(`server:${data.isActive}`);
    return pluginRow(data.name, data.isActive);
  });
});

describe('usePluginToggle', () => {
  it('успіх: спершу serverFn, потім хуки; відповідь сервера — у кеш', async () => {
    sync.mockImplementation(async (_name: string, isActive: boolean) => {
      order.push(`hooks:${isActive}`);
    });
    const { result } = renderHook(() => usePluginToggle(), {
      wrapper: makeWrapper(client),
    });

    result.current.toggle({ name: 'hello', isActive: true });

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(order).toEqual(['server:true', 'hooks:true']);
    expect(sync).toHaveBeenCalledWith('hello', true);
    expect(cached()).toBe(true);
    expect(toastError).not.toHaveBeenCalled();
  });

  it('реєстрація хуків впала → другий setPluginActive({ isActive: false }) і тост', async () => {
    sync.mockRejectedValue(new Error('register boom'));
    const { result } = renderHook(() => usePluginToggle(), {
      wrapper: makeWrapper(client),
    });

    result.current.toggle({ name: 'hello', isActive: true });

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        t('admin.plugins.registerFailed', { name: 'hello' }),
      ),
    );
    expect(mocks.setPluginActive.mock.calls).toEqual([
      [{ data: { name: 'hello', isActive: true } }],
      [{ data: { name: 'hello', isActive: false } }],
    ]);
    // Кеш — стан після відкату, а не «увімкнено».
    expect(cached()).toBe(false);
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(mocks.listPlugins).not.toHaveBeenCalled();
  });

  it('впали і реєстрація, і відкат → тост «вимкніть вручну», кеш перечитано з listPlugins', async () => {
    sync.mockRejectedValue(new Error('register boom'));
    mocks.setPluginActive
      .mockResolvedValueOnce(pluginRow('hello', true))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));
    // Стан БД після невдалого відкату — плагін увімкнено.
    const dbRows = [pluginRow('hello', true, { fromDb: 'yes' })];
    mocks.listPlugins.mockResolvedValue(dbRows);
    const { result } = renderHook(() => usePluginToggle(), {
      wrapper: makeWrapper(client),
    });

    result.current.toggle({ name: 'hello', isActive: true });

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        t('admin.plugins.registerFailedStuck', { name: 'hello' }),
      ),
    );
    expect(mocks.setPluginActive).toHaveBeenCalledTimes(2);
    expect(mocks.listPlugins).toHaveBeenCalledTimes(1);
    // У кеші — саме перечитаний список (стан БД), а не відповідь першого виклику.
    expect(client.getQueryData(KEY)).toEqual(dbRows);
    expect(cached()).toBe(true);
    expect(toastError).toHaveBeenCalledTimes(1);
  });
});
