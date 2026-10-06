import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * `getStorefrontRoot` нормалізує `siteUrl` ОДИН раз: споживачі (canonical,
 * JSON-LD) клеять `${siteUrl}/шлях`, і кінцевий `/` з env дав би `//`.
 *
 * Білдер `createServerFn` підмінено тотожністю над хендлером: тут перевіряємо
 * тіло serverFn, а не RPC-транспорт Start.
 */
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({ handler: (fn: () => unknown) => fn }),
}));
vi.mock('simplycms/storefront/loaders', () => ({
  loadActiveTheme: vi.fn(async () => ({ name: 'solarstore' })),
  loadStoreProfile: vi.fn(async () => ({ name: 'Крамниця' })),
}));

const { getStorefrontRoot } = await import('../root');
const call = getStorefrontRoot as unknown as () => Promise<{
  activeThemeName: string;
  siteUrl: string;
}>;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getStorefrontRoot', () => {
  it('кінцеві / у VITE_SITE_URL обрізаються', async () => {
    vi.stubEnv('VITE_SITE_URL', 'https://shop.example//');
    const root = await call();
    expect(root.siteUrl).toBe('https://shop.example');
    expect(root.activeThemeName).toBe('solarstore');
  });

  it('незаданий VITE_SITE_URL → порожній рядок', async () => {
    vi.stubEnv('VITE_SITE_URL', undefined);
    expect((await call()).siteUrl).toBe('');
  });

  it('невалідний VITE_SITE_URL → порожній рядок і ОДНЕ попередження на процес', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      for (const bad of [
        'shop.example',
        'localhost:3000',
        'ftp://shop.example',
      ]) {
        vi.stubEnv('VITE_SITE_URL', bad);
        expect((await call()).siteUrl).toBe('');
      }
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]?.[0])).toContain('shop.example');
    } finally {
      warn.mockRestore();
    }
  });

  it('http-адреса (локальний стенд) — валідна', async () => {
    vi.stubEnv('VITE_SITE_URL', 'http://localhost:3000/');
    expect((await call()).siteUrl).toBe('http://localhost:3000');
  });
});
