// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

const load = vi.hoisted(() => vi.fn(async (_name: string) => undefined));
vi.mock('simplycms/themes/ThemeRegistry', () => ({
  ThemeRegistry: { load },
}));

import { ACTIVE_THEME_GLOBAL } from '../../active-theme';
import { prepareStorefrontHydration } from '../prepare';

const setTheme = (name?: string) => {
  (window as unknown as Record<string, unknown>)[ACTIVE_THEME_GLOBAL] = name;
};

afterEach(() => {
  setTheme(undefined);
  load.mockReset();
  load.mockImplementation(async () => undefined);
});

describe('prepareStorefrontHydration', () => {
  it('вантажить активну тему, назву якої проставив сервер', async () => {
    setTheme('solarstore');
    await prepareStorefrontHydration();
    expect(load).toHaveBeenCalledWith('solarstore');
  });

  it('без назви від сервера — тема default', async () => {
    await prepareStorefrontHydration();
    expect(load).toHaveBeenCalledWith('default');
  });

  it('збій теми не блокує гідрацію', async () => {
    load.mockRejectedValueOnce(new Error('chunk 404'));
    await expect(prepareStorefrontHydration()).resolves.toBeUndefined();
  });
});
