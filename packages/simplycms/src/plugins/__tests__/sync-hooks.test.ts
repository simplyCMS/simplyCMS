import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hookRegistry } from '../HookRegistry';
import { registerPluginModule } from '../PluginLoader';
import { syncPluginHooks } from '../sync-hooks';

const HOOK = 'admin.dashboard.widgets';
const OTHER = 'product.detail.after';

const owners = (hook: string) => hookRegistry.getPluginsForHook(hook);

beforeEach(() => {
  hookRegistry.clear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  hookRegistry.clear();
});

describe('syncPluginHooks', () => {
  it('register модуля впав → кидає, а частково зареєстровані хуки зняті', async () => {
    registerPluginModule('half', {
      register: (registry) => {
        registry.register(HOOK, 'half', () => null);
        throw new Error('boom');
      },
    });

    await expect(syncPluginHooks('half', true)).rejects.toThrow('boom');
    expect(owners(HOOK)).toEqual([]);
  });

  it('невідомий модуль при вмиканні → кидає, реєстр без змін', async () => {
    await expect(syncPluginHooks('missing', true)).rejects.toThrow('missing');
    expect(hookRegistry.getRegisteredHooks()).toEqual([]);
  });

  it('вимикання знімає ВСІ хуки плагіна, навіть якщо unregister впав', async () => {
    registerPluginModule('noisy', {
      register: (registry) => {
        registry.register(HOOK, 'noisy', () => null);
        registry.register(OTHER, 'noisy', () => null);
      },
      unregister: () => {
        throw new Error('unregister boom');
      },
    });
    await syncPluginHooks('noisy', true);
    expect(owners(HOOK)).toEqual(['noisy']);

    await expect(syncPluginHooks('noisy', false)).resolves.toBeUndefined();
    expect(owners(HOOK)).toEqual([]);
    expect(owners(OTHER)).toEqual([]);
  });
});
