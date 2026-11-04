// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

/**
 * І44 (спека §19.5): у відрендереному HTML вітрини не буває сирого ключа каталогу —
 * ні в текстовому вузлі, ні в значенні атрибута. Сирий ключ — ознака каталогу, що не
 * встиг завантажитись до рендера (`t()` повертає ключ як є). Роутер, лоадер кореня й
 * `head()` справжні; з підміненого лише серверний вхід у БД. Кожен кейс — на свіжому
 * реєстрі каталогів (`no-raw-keys-app.tsx`), тож результат не залежить від порядку.
 */
vi.mock('../server/root', () => ({
  getStorefrontRoot: async () => ({
    activeThemeName: 'default',
    storeProfile: {
      name: 'Крамниця',
      homeTitle: null,
      description: null,
      contacts: { phone: null, email: null, address: null, hours: null },
      logoUrl: null,
      socials: [],
    },
    siteUrl: 'https://shop.test',
  }),
}));
vi.mock('simplycms/core/hooks/useAuth', () => ({
  useAuth: () => ({ user: null, isLoading: false }),
}));
// Карусель на embla не потрібна: тут важлива лише назва блока з каталогу.
vi.mock('../components/ProductCarousel', () => ({
  ProductCarousel: ({ title }: { title: string }) => <h2>{title}</h2>,
}));
vi.mock('../components/BannerSlider', () => ({ BannerSlider: () => null }));
vi.mock('../shells/useActiveThemeModule', () => ({
  useActiveThemeModule: () => ({ components: {} }),
}));
// Клієнтський рендер перезапитує товар на монтуванні: мок віддає той самий рядок, що лоадер.
const fixtures = vi.hoisted(() => ({
  product: (_locale: string): unknown => null,
}));
vi.mock('../server/products', () => ({
  getProduct: async ({ data }: { data: { locale: string } }) =>
    fixtures.product(data.locale),
  getMovedProductPath: async () => null,
  getModificationData: async () => ({ propertyValues: {}, stock: {} }),
}));

import {
  PAGE_TEXT,
  product,
  rawKeysIn,
  visibleStrings,
} from './no-raw-keys-fixtures';
import { loadApp } from './no-raw-keys-app';

fixtures.product = product;

// Кожен кейс імпортує граф вітрини наново (свіжий реєстр): холодний імпорт під навантаженням
// повного прогону перевищує дефолтні 5 с.
vi.setConfig({ testTimeout: 30_000 });

describe('у HTML вітрини немає сирих ключів каталогу (І44)', () => {
  for (const lang of ['uk', 'en', 'pl']) {
    const prefix = lang === 'uk' ? '' : `/${lang}`;
    for (const path of ['/', '/x', '/cart']) {
      const url = `${prefix}${path === '/' && prefix ? '' : path}` || '/';
      it(`${url}: жоден текстовий вузол чи атрибут не дорівнює ключу`, async () => {
        const { ssr } = await loadApp();
        const doc = await ssr(url);
        const strings = visibleStrings(doc);
        // Не вакуум: порожня оболонка (корінь призупинився на каталозі) теж не має ключів,
        // тож сторінка мусить показати свій перекладений текст мовою ІНТЕРФЕЙСУ (pl → uk).
        expect(doc.body.textContent).toContain(
          PAGE_TEXT[lang === 'en' ? 'en' : 'uk'][path],
        );
        expect(rawKeysIn(strings)).toEqual([]);
      });
    }
  }

  it('детектор бачить сирий ключ (негативний контроль самого помічника)', () => {
    const doc = new DOMParser().parseFromString(
      '<button title="common.save">common.save</button>',
      'text/html',
    );
    expect(rawKeysIn(visibleStrings(doc))).toEqual([
      'common.save',
      'common.save',
    ]);
  });

  it('/en/x — інтерфейс англійською, а /pl/x (без пакета pl) — основною мовою', async () => {
    const { ssr } = await loadApp();
    expect((await ssr('/en/x')).body.textContent).toContain('Add to cart');
    expect((await ssr('/pl/x')).body.textContent).not.toContain('Add to cart');
  });

  it('клієнтський перехід /x → /en/x: після load() англійський рендер без сирих ключів', async () => {
    const { buildRouter, RouterProvider, act, renderIntoDom } = await loadApp();
    const router = buildRouter('/x');
    await router.load();
    const view = renderIntoDom(<RouterProvider router={router} />);
    expect(view.container.ownerDocument.body.textContent).not.toContain(
      'Add to cart',
    );

    await act(async () => {
      await router.navigate({ href: '/en/x' });
      await router.load();
    });

    const doc = view.container.ownerDocument;
    expect(doc.body.textContent).toContain('Add to cart');
    expect(rawKeysIn(visibleStrings(doc.body))).toEqual([]);
    view.unmount();
  });
});
