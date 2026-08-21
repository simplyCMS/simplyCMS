import { describe, expect, it } from 'vitest';
import type { HookRegistryInterface } from 'simplycms/plugins/types';
import { definePlugin } from '../definePlugin';

/** Мінімальний двійник реєстру: записує виклики, нічого не виконує. */
function makeRegistry() {
  const registered: { hook: string; plugin: string }[] = [];
  const unregistered: { hook: string; plugin: string }[] = [];
  const registry = {
    register: (hook: string, plugin: string) => {
      registered.push({ hook, plugin });
    },
    unregister: (hook: string, plugin: string) => {
      unregistered.push({ hook, plugin });
    },
    execute: async () => [],
    getHandlers: () => [],
    clear: () => {},
  } as unknown as HookRegistryInterface;
  return { registry, registered, unregistered };
}

const base = {
  name: 'demo',
  displayName: 'Demo',
  version: '0.1.0',
  engines: { simplycms: '>=0.1.0' },
};

describe('definePlugin', () => {
  it('генерує register/unregister зі слотів і хуків', () => {
    const module = definePlugin({
      ...base,
      slots: { 'admin.dashboard.widgets': () => null },
      hooks: { 'order.created': () => undefined },
    });
    const { registry, registered, unregistered } = makeRegistry();

    module.register(registry);
    expect(registered).toEqual([
      { hook: 'admin.dashboard.widgets', plugin: 'demo' },
      { hook: 'order.created', plugin: 'demo' },
    ]);

    module.unregister?.(registry);
    expect(unregistered.map((u) => u.hook).sort()).toEqual([
      'admin.dashboard.widgets',
      'order.created',
    ]);
  });

  it('маніфест насичується з декларації, hooks — обʼєднання слотів і хуків', () => {
    const module = definePlugin({
      ...base,
      description: 'Demo plugin',
      slots: { 'product.detail.after': () => null },
      migrations: ['20260814000000_plg_demo_items.sql'],
    });
    expect(module.manifest).toMatchObject({
      name: 'demo',
      displayName: 'Demo',
      version: '0.1.0',
      engines: { simplycms: '>=0.1.0' },
      hooks: [{ name: 'product.detail.after' }],
      migrations: ['20260814000000_plg_demo_items.sql'],
    });
    // Результат структурно задовольняє чинний PluginModule.
    expect(typeof module.register).toBe('function');
    expect(typeof module.unregister).toBe('function');
  });

  it('невалідне імʼя / відсутні engines — гучний виняток', () => {
    expect(() => definePlugin({ ...base, name: 'Bad Name' })).toThrow(
      /Невалідне імʼя/,
    );
    expect(() =>
      definePlugin({ ...base, engines: undefined as never }),
    ).toThrow(/engines\.simplycms/);
  });

  it('колізія імені між slots і hooks — виняток', () => {
    expect(() =>
      definePlugin({
        ...base,
        slots: { 'product.detail.after': () => null },
        hooks: { 'product.detail.after': () => undefined },
      }),
    ).toThrow(/і в slots, і в hooks/);
  });
});
