// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useEffect } from 'react';
import { render, screen, act, cleanup } from '@testing-library/react';
import { hookRegistry } from '../HookRegistry';
import { PluginSlot, usePluginSlot } from '../PluginSlot';

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
