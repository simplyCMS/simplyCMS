// Д6 (замінив Е6б-9): операції адмінки збільшують покоління кешу вітрини У СВОЇЙ
// транзакції — тією ж `db`, що дістав `runAdmin`, — а не після COMMIT процесним
// скиданням. Відмова транзакції покоління не піднімає. Тривале «дві репліки» —
// у `test-harness/pg/__tests__/cache-generations.test.ts`; тут лише контракт
// виклику: який ключ, на якій `db`, рівно раз.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const bump = vi.hoisted(() => vi.fn(async (_db: unknown, _key: string) => {}));
// Одна «db» на всі виклики: тест звіряє саме її ідентичність.
const fakeDb = vi.hoisted(() => {
  // Ланцюжок drizzle: кожен виклик повертає себе, `await` дає порожній
  // результат, а `returning` — один рядок (save-settings читає `updated`).
  const chain: Record<string, unknown> = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === 'then')
          return (resolve: (v: unknown) => void) => resolve(undefined);
        if (prop === 'returning') return async () => [{}];
        return () => chain;
      },
    },
  );
  return chain;
});

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/site', () => ({
  CACHE_KEYS: {
    storeProfile: 'store-profile',
    activeTheme: 'active-theme',
    languages: 'languages',
  },
  bumpCacheGeneration: bump,
  isBuiltTheme: () => true,
  readStoreProfile: vi.fn(async () => ({ logo: null })),
}));
vi.mock('simplycms/storage', () => ({
  completeMediaErasures: vi.fn(async () => {}),
  eraseMediaRows: vi.fn(async () => []),
}));
vi.mock('../catalog-lock', () => ({
  lockCatalogTarget: vi.fn(async () => {}),
}));
vi.mock('../site-themes/list', () => ({
  THEME_COLUMNS: {},
  toThemeRow: (row: unknown) => row,
  selectThemeRows: vi.fn(async () => [{ isActive: true }]),
}));
// `runAdmin` виконує колбек на `fakeDb`; `fail` імітує відмову ДО колбека.
const run = vi.hoisted(() => ({ fail: false, commits: 0 }));
vi.mock('../run', () => ({
  runAdmin: vi.fn(
    async (_op: string, fn: (db: unknown) => Promise<unknown>) => {
      if (run.fail) throw new Error('відмова');
      const result = await fn(fakeDb);
      run.commits += 1;
      return result;
    },
  ),
}));

import { saveStoreProfileOp } from '../settings/save-profile';
import { activateThemeOp } from '../site-themes/activate';
import { saveThemeSettingsOp } from '../site-themes/save-settings';

const profile = {
  name: 'Крамниця',
  homeTitle: null,
  description: null,
  contacts: { phone: null, email: null, address: null, hours: null },
  logo: null,
  socials: [],
};

const cases = [
  [
    'saveStoreProfile',
    'store-profile',
    () => saveStoreProfileOp({ data: profile }),
  ],
  [
    'activateTheme',
    'active-theme',
    () => activateThemeOp({ data: { name: 'default' } }),
  ],
  [
    'saveThemeSettings',
    'active-theme',
    () =>
      saveThemeSettingsOp({ data: { name: 'default', settings: { a: 1 } } }),
  ],
] as const;

describe('покоління кешу site збільшується в транзакції (Д6)', () => {
  beforeEach(() => {
    bump.mockClear();
    run.fail = false;
    run.commits = 0;
  });

  it.each(cases)(
    '%s: рівно раз, на db транзакції, до її завершення',
    async (_n, key, call) => {
      bump.mockImplementationOnce(async () => {
        // Колбек ще не завершився: COMMIT настане після цього виклику.
        expect(run.commits).toBe(0);
      });
      await call();
      expect(bump).toHaveBeenCalledTimes(1);
      // `toBe`, а не deep-equal: Proxy-ланцюжок порівнювався б «однаковим» з будь-яким.
      expect(bump.mock.calls[0][0]).toBe(fakeDb);
      expect(bump.mock.calls[0][1]).toBe(key);
    },
  );

  it.each(cases)(
    '%s: транзакція відмовила — покоління не збільшено',
    async (_n, _key, call) => {
      run.fail = true;
      await expect(call()).rejects.toThrow('відмова');
      expect(bump).not.toHaveBeenCalled();
    },
  );
});
