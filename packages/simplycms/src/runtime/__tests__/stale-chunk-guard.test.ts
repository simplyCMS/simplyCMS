import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BUILD_ID } from '../build-id';

type Mod = typeof import('../stale-chunk');

// Новий документ = новий екземпляр модуля (модульний прапорець reloadPending).
async function newDocument(): Promise<Mod> {
  vi.resetModules();
  return import('../stale-chunk');
}

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

const staleError = new TypeError(
  'Failed to fetch dynamically imported module: https://shop.test/assets/app-OLD.js',
);

describe('installStaleChunkGuard', () => {
  let m: Mod;
  beforeEach(async () => {
    m = await newDocument();
  });
  afterEach(() => vi.unstubAllGlobals());

  function setup() {
    const store = memoryStorage();
    const reload = vi.fn();
    vi.stubGlobal('window', {
      sessionStorage: store,
      location: { reload },
    });
    const listeners: Array<(e: Event) => void> = [];
    const install = () =>
      m.installStaleChunkGuard({
        addEventListener: (_t: string, l: (e: Event) => void) =>
          void listeners.push(l),
      } as unknown as Window);
    install();
    const fire = (payload: unknown) => {
      const preventDefault = vi.fn();
      for (const l of listeners) {
        l({ payload, preventDefault } as unknown as Event);
      }
      return preventDefault;
    };
    return { reload, fire, store, install };
  }

  it('чанкова помилка: reload і preventDefault', () => {
    const { reload, fire } = setup();
    expect(fire(staleError)).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('сторож уже стоїть (reload був) — подію не глушимо, reload не повторюється', () => {
    const { reload, fire, store } = setup();
    store.setItem(
      `${m.CHUNK_RELOAD_KEY_PREFIX}${BUILD_ID}:${staleError.message}`,
      '1',
    );
    expect(fire(staleError)).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('подвійне встановлення: два слухачі, але одне перезавантаження', () => {
    const { reload, fire, install } = setup();
    install();
    fire(staleError);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
