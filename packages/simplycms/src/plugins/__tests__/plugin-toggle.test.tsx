// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { hookRegistry } from '../HookRegistry';
import { PluginSlot } from '../PluginSlot';
import { activatePlugin, deactivatePlugin } from '../PluginLoader';
import {
  HOOK,
  Marker,
  PLUGIN,
  makeSupabase,
  markerMountCount,
  registerDemoPlugin,
  resetMarkerMounts,
  settle,
} from './helpers/slot-harness';

registerDemoPlugin();

describe('toggle плагіна: атомарний порядок БД → registry', () => {
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

  it('activatePlugin оновлює слот без ремаунта і пише в БД ДО реєстру', async () => {
    const db = makeSupabase(false);
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
      expect(await activatePlugin(db.client, PLUGIN)).toBe(true);
    });
    await settle();

    expect(screen.getByText('W')).toBeTruthy();
    // Ремаунта піддерева не було — оновилася лише підписка слота.
    expect(screen.getByTestId('marker')).toBe(markerBefore);
    expect(markerMountCount()).toBe(1);
    // На момент запису в БД реєстр ще порожній — саме цей порядок і потрібен.
    expect(db.writes).toEqual([true]);
    expect(db.registryAtWrite).toEqual([0]);
  });

  it('deactivatePlugin прибирає віджет без ремаунта', async () => {
    const db = makeSupabase(false);
    await activatePlugin(db.client, PLUGIN);

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
      expect(await deactivatePlugin(db.client, PLUGIN)).toBe(true);
    });
    await settle();

    expect(screen.queryByText('W')).toBeNull();
    expect(screen.getByTestId('marker')).toBe(markerBefore);
    expect(markerMountCount()).toBe(1);
    expect(db.writes).toEqual([true, false]);
    // Хуки ще на місці, коли БД приймає запис: спершу БД, потім реєстр.
    expect(db.registryAtWrite).toEqual([0, 1]);
  });

  it('збій БД при activate: реєстр без змін, слот порожній', async () => {
    const db = makeSupabase(true);
    render(<PluginSlot name={HOOK} />);
    await settle();

    await act(async () => {
      expect(await activatePlugin(db.client, PLUGIN)).toBe(false);
    });
    await settle();

    expect(hookRegistry.getPluginsForHook(HOOK)).toEqual([]);
    expect(screen.queryByText('W')).toBeNull();
  });

  it('збій БД при deactivate: хуки лишаються, віджет на місці', async () => {
    await activatePlugin(makeSupabase(false).client, PLUGIN);
    render(<PluginSlot name={HOOK} />);
    await settle();
    expect(screen.getByText('W')).toBeTruthy();

    const failing = makeSupabase(true);
    await act(async () => {
      expect(await deactivatePlugin(failing.client, PLUGIN)).toBe(false);
    });
    await settle();

    expect(hookRegistry.getPluginsForHook(HOOK)).toEqual([PLUGIN]);
    expect(screen.getByText('W')).toBeTruthy();
  });
});
