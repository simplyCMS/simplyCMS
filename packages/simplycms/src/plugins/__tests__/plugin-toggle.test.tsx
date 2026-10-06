// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { hookRegistry } from '../HookRegistry';
import { PluginSlot } from '../PluginSlot';
import { registerPluginModule } from '../PluginLoader';
import { syncPluginHooks } from '../sync-hooks';
import {
  HOOK,
  Marker,
  PLUGIN,
  markerMountCount,
  registerDemoPlugin,
  resetMarkerMounts,
  settle,
} from './helpers/slot-harness';

registerDemoPlugin();

/**
 * Перемикання плагіна з адмінки міняє сторінку БЕЗ reload: `syncPluginHooks`
 * мутує `HookRegistry`, а `PluginSlot` підписаний на його версію. Запис у БД
 * тут не перевіряється — його робить serverFn `setPluginActive` до виклику
 * (`admin/features/plugins/usePluginToggle`).
 */
describe('toggle плагіна: syncPluginHooks → PluginSlot', () => {
  beforeEach(() => {
    hookRegistry.clear();
    resetMarkerMounts();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    hookRegistry.clear();
  });

  it('вмикання показує віджет у слоті без ремаунта сусідів', async () => {
    render(
      <div>
        <Marker />
        <PluginSlot name={HOOK} />
      </div>,
    );
    await settle();
    expect(screen.queryByText('W')).toBeNull();
    const markerBefore = screen.getByTestId('marker');

    await act(async () => {
      await syncPluginHooks(PLUGIN, true);
    });
    await settle();

    expect(screen.getByText('W')).toBeTruthy();
    // Ремаунта піддерева не було — оновилася лише підписка слота.
    expect(screen.getByTestId('marker')).toBe(markerBefore);
    expect(markerMountCount()).toBe(1);
  });

  it('вимикання прибирає віджет без ремаунта', async () => {
    await syncPluginHooks(PLUGIN, true);
    render(
      <div>
        <Marker />
        <PluginSlot name={HOOK} />
      </div>,
    );
    await settle();
    expect(screen.getByText('W')).toBeTruthy();
    const markerBefore = screen.getByTestId('marker');

    await act(async () => {
      await syncPluginHooks(PLUGIN, false);
    });
    await settle();

    expect(screen.queryByText('W')).toBeNull();
    expect(screen.getByTestId('marker')).toBe(markerBefore);
    expect(markerMountCount()).toBe(1);
  });

  it('register впав: слот лишається порожнім, реєстр — без хуків плагіна', async () => {
    registerPluginModule('broken', {
      register: (registry) => {
        registry.register(HOOK, 'broken', () => <b>X</b>);
        throw new Error('boom');
      },
    });
    render(<PluginSlot name={HOOK} />);
    await settle();

    await act(async () => {
      await expect(syncPluginHooks('broken', true)).rejects.toThrow('boom');
    });
    await settle();

    expect(hookRegistry.getPluginsForHook(HOOK)).toEqual([]);
    expect(screen.queryByText('X')).toBeNull();
  });
});
