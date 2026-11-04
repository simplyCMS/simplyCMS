// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('simplycms/themes/ThemeRegistry', () => ({
  ThemeRegistry: { load: vi.fn(async () => undefined) },
}));

/** Реєстр каталогів має модульний кеш — кожен тест бере свіжий граф модулів. */
async function fresh(pathname: string) {
  vi.resetModules();
  window.__SCMS_LOCALES__ = { primary: 'uk', published: ['uk', 'en', 'pl'] };
  window.history.replaceState({}, '', pathname);
  const { prepareStorefrontHydration } = await import('../prepare');
  const { loadUiCatalog, resolveUiLocale, getUiPack } =
    await import('simplycms/i18n');
  const { checkedContentLocale: cl } =
    await import('simplycms/domain/translations');
  const uiOf = (code: string) => resolveUiLocale(cl(code), cl('uk'));
  const spy = (code: string, part: 'base' | 'admin') =>
    vi.spyOn(getUiPack(uiOf(code)).ui, part);
  return { prepareStorefrontHydration, loadUiCatalog, uiOf, spy };
}

declare global {
  interface Window {
    __SCMS_LOCALES__?: unknown;
  }
}

afterEach(() => {
  delete window.__SCMS_LOCALES__;
  vi.restoreAllMocks();
});

describe('prepareStorefrontHydration', () => {
  it('/en/x → base мови en завантажено (fulfilled), admin і uk не вантажились', async () => {
    const { prepareStorefrontHydration, loadUiCatalog, uiOf, spy } =
      await fresh('/en/x');
    const admin = spy('en', 'admin');
    const ukBase = spy('uk', 'base');

    await prepareStorefrontHydration();

    expect(loadUiCatalog(uiOf('en'), 'base').status).toBe('fulfilled');
    expect(admin).not.toHaveBeenCalled();
    expect(ukBase).not.toHaveBeenCalled();
  });

  it('/pl/x (пакета pl немає) → base основної мови uk', async () => {
    const { prepareStorefrontHydration, loadUiCatalog, uiOf } =
      await fresh('/pl/x');

    await prepareStorefrontHydration();

    expect(loadUiCatalog(uiOf('uk'), 'base').status).toBe('fulfilled');
  });

  it('/admin → base основної мови (свою мову адмінка вантажить сама), admin не вантажиться', async () => {
    const { prepareStorefrontHydration, loadUiCatalog, uiOf, spy } =
      await fresh('/admin');
    const admin = spy('uk', 'admin');

    await prepareStorefrontHydration();

    expect(loadUiCatalog(uiOf('uk'), 'base').status).toBe('fulfilled');
    expect(admin).not.toHaveBeenCalled();
  });

  it('збій каталогу не ковтається', async () => {
    const { prepareStorefrontHydration, spy } = await fresh('/en/x');
    spy('en', 'base').mockRejectedValueOnce(new Error('chunk 404'));

    await expect(prepareStorefrontHydration()).rejects.toThrow('chunk 404');
  });
});
