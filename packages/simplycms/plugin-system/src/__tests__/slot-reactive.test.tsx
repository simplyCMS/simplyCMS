// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useEffect } from 'react';
import { render, screen, act, cleanup } from '@testing-library/react';
import { hookRegistry } from '../HookRegistry';
import { PluginSlot } from '../PluginSlot';

/** Лічильник монтувань сусіда — доводить, що піддерево не перемонтовується. */
let markerMounts = 0;
function Marker() {
  useEffect(() => {
    markerMounts += 1;
  }, []);
  return <span data-testid="marker" />;
}

describe('PluginSlot реактивність до HookRegistry', () => {
  beforeEach(() => {
    hookRegistry.clear();
    markerMounts = 0;
  });

  afterEach(() => {
    cleanup();
    hookRegistry.clear();
  });

  it('віджет зʼявляється після register без ремаунта слота', async () => {
    render(
      <div>
        <Marker />
        <PluginSlot name="admin.dashboard.widgets" />
      </div>,
    );

    expect(screen.queryByText('W')).toBeNull();
    const markerBefore = screen.getByTestId('marker');

    // Реєстрація ПІСЛЯ монтування — без повторного render()/rerender().
    await act(async () => {
      hookRegistry.register('admin.dashboard.widgets', 'p', () => <b>W</b>);
    });

    expect(screen.getByText('W')).toBeTruthy();
    expect(screen.getByTestId('marker')).toBe(markerBefore);
    expect(markerMounts).toBe(1);
  });

  it('віджет зникає після unregister (семантика toggle в адмінці)', async () => {
    hookRegistry.register('admin.dashboard.widgets', 'p', () => <b>W</b>);
    render(<PluginSlot name="admin.dashboard.widgets" />);

    await act(async () => {});
    expect(screen.getByText('W')).toBeTruthy();

    await act(async () => {
      hookRegistry.unregister('admin.dashboard.widgets', 'p');
    });

    expect(screen.queryByText('W')).toBeNull();
  });
});
