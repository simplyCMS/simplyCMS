// Е6б-9: операції адмінки скидають кеш вітрини ПІСЛЯ того, як `runAdmin`
// повернувся (після COMMIT), рівно раз — і не скидають на відмові. Скидання
// всередині транзакції дало б вікно, де читання вітрини до COMMIT кешує старе.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const site = vi.hoisted(() => ({
  profile: vi.fn(),
  theme: vi.fn(),
}));
const run = vi.hoisted(() => ({
  pending: null as null | {
    resolve: (v: unknown) => void;
    reject: (e: unknown) => void;
  },
}));

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/site', () => ({
  storeProfileCache: { invalidate: site.profile, get: vi.fn() },
  activeThemeCache: { invalidate: site.theme, get: vi.fn() },
  isBuiltTheme: () => true,
  readStoreProfile: vi.fn(),
}));
// `runAdmin` — керований проміс: тест сам вирішує, коли «COMMIT» і чи він був.
vi.mock('../run', () => ({
  runAdmin: vi.fn(
    () =>
      new Promise((resolve, reject) => {
        run.pending = { resolve, reject };
      }),
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
    site.profile,
    () => saveStoreProfileOp({ data: profile }),
  ],
  [
    'activateTheme',
    site.theme,
    () => activateThemeOp({ data: { name: 'default' } }),
  ],
  [
    'saveThemeSettings',
    site.theme,
    () =>
      saveThemeSettingsOp({ data: { name: 'default', settings: { a: 1 } } }),
  ],
] as const;

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('скидання кешу site після runAdmin (Е6б-9)', () => {
  beforeEach(() => {
    site.profile.mockClear();
    site.theme.mockClear();
    run.pending = null;
  });

  it.each(cases)(
    '%s: поки runAdmin не повернувся — кеш не скинуто; після — рівно раз',
    async (_n, spy, call) => {
      const op = call();
      await tick();
      expect(run.pending).not.toBeNull();
      expect(spy).not.toHaveBeenCalled();
      run.pending!.resolve([]);
      await op;
      expect(spy).toHaveBeenCalledTimes(1);
      expect(
        site.profile.mock.calls.length + site.theme.mock.calls.length,
      ).toBe(1);
    },
  );

  it.each(cases)(
    '%s: runAdmin відмовив — кеш не скинуто',
    async (_n, spy, call) => {
      const op = call();
      await tick();
      run.pending!.reject(new Error('відмова'));
      await expect(op).rejects.toThrow('відмова');
      expect(spy).not.toHaveBeenCalled();
    },
  );
});
