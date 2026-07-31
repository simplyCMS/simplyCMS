// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useEffect } from 'react';
import { render, screen, act, cleanup } from '@testing-library/react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hookRegistry } from '../HookRegistry';
import { PluginSlot, usePluginSlot } from '../PluginSlot';
import {
  activatePlugin,
  deactivatePlugin,
  registerPluginModule,
} from '../PluginLoader';

/** Лічильник монтувань сусіда — доводить, що піддерево не перемонтовується. */
let markerMounts = 0;
function Marker() {
  useEffect(() => {
    markerMounts += 1;
  }, []);
  return <span data-testid="marker" />;
}

/**
 * Довести, що слот стабілізувався ПІСЛЯ монтування: перший `execute()`
 * асинхронний, його `.then(commit)` робить `setState` і сам по собі спричиняє
 * зайвий рендер. Якщо реєструвати плагін до цього резолву, віджет зʼявиться
 * навіть з мертвою підпискою — тест доводив би не те. Тому спершу вичерпуємо
 * усі мікротаски й лише тоді чіпаємо реєстр.
 */
async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('PluginSlot реактивність до HookRegistry', () => {
  beforeEach(() => {
    hookRegistry.clear();
    markerMounts = 0;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    hookRegistry.clear();
  });

  it('віджет зʼявляється після register без ремаунта слота', async () => {
    render(
      <div>
        <Marker />
        <PluginSlot name="admin.dashboard.widgets" />
      </div>,
    );

    // Слот повністю стабільний: жодного відкладеного рендера в черзі.
    await settle();
    expect(screen.queryByText('W')).toBeNull();
    const markerBefore = screen.getByTestId('marker');

    // Реєстрація ПІСЛЯ стабілізації — рендер може спричинити лише підписка.
    await act(async () => {
      hookRegistry.register('admin.dashboard.widgets', 'p', () => <b>W</b>);
    });
    await settle();

    expect(screen.getByText('W')).toBeTruthy();
    expect(screen.getByTestId('marker')).toBe(markerBefore);
    expect(markerMounts).toBe(1);
  });

  it('віджет зникає після unregister (семантика toggle в адмінці)', async () => {
    hookRegistry.register('admin.dashboard.widgets', 'p', () => <b>W</b>);
    render(<PluginSlot name="admin.dashboard.widgets" />);

    await settle();
    expect(screen.getByText('W')).toBeTruthy();

    await act(async () => {
      hookRegistry.unregister('admin.dashboard.widgets', 'p');
    });
    await settle();

    expect(screen.queryByText('W')).toBeNull();
  });

  it('слот підписується на реєстр, отримує нотифікацію і відписується', async () => {
    // Обгортка над справжнім subscribe: рахує нотифікації саме того слухача,
    // якого зареєстрував слот, не підміняючи реальної поведінки реєстру.
    const realSubscribe = hookRegistry.subscribe;
    let notified = 0;
    const subscribeSpy = vi
      .spyOn(hookRegistry, 'subscribe')
      .mockImplementation((listener: () => void) =>
        realSubscribe(() => {
          notified += 1;
          listener();
        }),
      );

    const view = render(<PluginSlot name="admin.dashboard.widgets" />);
    await settle();
    expect(subscribeSpy).toHaveBeenCalled();
    expect(notified).toBe(0);

    await act(async () => {
      hookRegistry.register('admin.dashboard.widgets', 'p', () => <b>W</b>);
    });
    expect(notified).toBe(1);

    // Після розмонтування слухач знятий — нотифікації більше не доходять.
    view.unmount();
    hookRegistry.register('admin.dashboard.widgets', 'p2', () => <b>X</b>);
    expect(notified).toBe(1);
  });
});

const HOOK = 'admin.dashboard.widgets';
const PLUGIN = 'toggle-demo';

interface FakeDb {
  client: SupabaseClient;
  /** Значення `is_active`, записані в БД, у порядку викликів. */
  writes: boolean[];
  /** Скільки хендлерів плагіна було в реєстрі НА МОМЕНТ кожного запису. */
  registryAtWrite: number[];
}

/** Мінімальний двійник `supabase.from('plugins').update(...).eq(...)`. */
function makeSupabase(fails: boolean): FakeDb {
  const writes: boolean[] = [];
  const registryAtWrite: number[] = [];
  const client = {
    from: () => ({
      update: (patch: { is_active: boolean }) => ({
        eq: async () => {
          writes.push(patch.is_active);
          registryAtWrite.push(
            hookRegistry.getPluginsForHook(HOOK).filter((n) => n === PLUGIN)
              .length,
          );
          return fails ? { error: { message: 'db down' } } : { error: null };
        },
      }),
    }),
  };
  return {
    client: client as unknown as SupabaseClient,
    writes,
    registryAtWrite,
  };
}

registerPluginModule(PLUGIN, {
  register: (registry) => registry.register(HOOK, PLUGIN, () => <b>W</b>),
  unregister: (registry) => registry.unregister(HOOK, PLUGIN),
});

describe('toggle плагіна: атомарний порядок БД → registry', () => {
  beforeEach(() => {
    hookRegistry.clear();
    markerMounts = 0;
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
    expect(markerMounts).toBe(1);
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
    expect(markerMounts).toBe(1);
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

describe('usePluginSlot', () => {
  beforeEach(() => hookRegistry.clear());
  afterEach(() => {
    cleanup();
    hookRegistry.clear();
  });

  function Probe() {
    const { results, loading } = usePluginSlot<undefined, string>('probe.hook');
    return <span data-testid="probe">{loading ? '…' : results.join(',')}</span>;
  }

  it('віддає результати хуків і реагує на register', async () => {
    render(<Probe />);

    await settle();
    expect(screen.getByTestId('probe').textContent).toBe('');

    await act(async () => {
      hookRegistry.register('probe.hook', 'p', () => 'a');
    });
    await settle();

    expect(screen.getByTestId('probe').textContent).toBe('a');
  });
});
