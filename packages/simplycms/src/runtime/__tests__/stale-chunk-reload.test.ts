import { beforeEach, describe, expect, it, vi } from 'vitest';

type Mod = typeof import('../stale-chunk');

// Модульний прапорець «вже перезавантажуємо» = стан документа. Новий документ
// після reload — це новий екземпляр модуля при тому самому sessionStorage.
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

function deps(
  storage: ReturnType<typeof memoryStorage>,
  reload: () => void,
  build = 'b1',
  online = true,
) {
  return { session: () => storage, reload, build, online: () => online };
}

const staleError = new TypeError(
  'Failed to fetch dynamically imported module: https://shop.test/assets/app-OLD.js',
);

describe('reloadOnceForStaleChunk і предикат', () => {
  let m: Mod;
  beforeEach(async () => {
    m = await newDocument();
  });

  it('розпізнає помилки Chromium, Firefox, Safari і CSS Vite', () => {
    expect(m.isStaleChunkError(staleError)).toBe(true);
    expect(
      m.isStaleChunkError(
        new Error('error loading dynamically imported module'),
      ),
    ).toBe(true);
    expect(
      m.isStaleChunkError(new TypeError('Importing a module script failed.')),
    ).toBe(true);
    expect(
      m.isStaleChunkError(new Error('Unable to preload CSS for /assets/a.css')),
    ).toBe(true);
    expect(m.isStaleChunkError(new Error('UNAUTHORIZED'))).toBe(false);
    expect(m.isStaleChunkError(null)).toBe(false);
  });

  it('перший виклик: reload один раз і true; другий у тому ж документі: true без reload', () => {
    const storage = memoryStorage();
    const reload = vi.fn();
    expect(m.reloadOnceForStaleChunk(staleError, deps(storage, reload))).toBe(
      true,
    );
    expect(reload).toHaveBeenCalledTimes(1);
    expect(
      storage.data.has(`${m.CHUNK_RELOAD_KEY_PREFIX}b1:${staleError.message}`),
    ).toBe(true);
    expect(m.reloadOnceForStaleChunk(staleError, deps(storage, reload))).toBe(
      true,
    );
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('та сама помилка після перезавантаження (новий модуль, той самий sessionStorage) → false', async () => {
    const storage = memoryStorage();
    const reload = vi.fn();
    m.reloadOnceForStaleChunk(staleError, deps(storage, reload));
    const reloaded = await newDocument();
    expect(
      reloaded.reloadOnceForStaleChunk(staleError, deps(storage, reload)),
    ).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('інша збірка — знову true (Safari без URL у повідомленні)', async () => {
    const safari = new TypeError('Importing a module script failed.');
    const storage = memoryStorage();
    const reload = vi.fn();
    expect(m.reloadOnceForStaleChunk(safari, deps(storage, reload, 'b1'))).toBe(
      true,
    );
    const next = await newDocument();
    expect(
      next.reloadOnceForStaleChunk(safari, deps(storage, reload, 'b2')),
    ).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('офлайн → false: ні reload, ні запису в сховище', () => {
    const storage = memoryStorage();
    const reload = vi.fn();
    expect(
      m.reloadOnceForStaleChunk(staleError, deps(storage, reload, 'b1', false)),
    ).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    expect(storage.data.size).toBe(0);
  });

  it('setItem кидає → false без reload (петлю нічим стерегти)', () => {
    const reload = vi.fn();
    expect(
      m.reloadOnceForStaleChunk(staleError, {
        session: () => ({
          getItem: () => null,
          setItem: () => {
            throw new Error('QuotaExceededError');
          },
        }),
        reload,
        build: 'b1',
        online: () => true,
      }),
    ).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('не-чанк помилка → false без reload і без запису в сховище', () => {
    const storage = memoryStorage();
    const reload = vi.fn();
    expect(
      m.reloadOnceForStaleChunk(
        new Error('UNAUTHORIZED'),
        deps(storage, reload),
      ),
    ).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    expect(storage.data.size).toBe(0);
  });

  it('геттер sessionStorage кидає → false без reload', () => {
    const reload = vi.fn();
    expect(
      m.reloadOnceForStaleChunk(staleError, {
        session: () => {
          throw new Error('SecurityError');
        },
        reload,
        build: 'b1',
        online: () => true,
      }),
    ).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
