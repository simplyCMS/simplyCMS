import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TextLocale } from 'simplycms/domain/translations';

/**
 * Р29: кожен публічний serverFn вітрини, що віддає `product_prices`, іде
 * через `withViewerDb` (глядач із сесії + `private, no-store` залогіненому) і
 * передає лоадеру САМЕ набір видів, який той дав. Повернення одного з них на
 * `withStorefrontDb` знову віддало б гостю всі прайси — і тест це ловить.
 */
const VIEWER = { ids: ['retail'] };
const TX = { tx: true };
/** Мова читання тексту, яку «визначив» `resolveTextLocale` (мок): передається лоадеру як є. */
const TEXT = { locale: 'en', primary: 'uk' } as TextLocale;

const loaders = vi.hoisted(() => ({
  withViewerDb: vi.fn(),
  withStorefrontDb: vi.fn(),
  loadProduct: vi.fn(),
  loadCatalogProducts: vi.fn(),
  loadPropertyOption: vi.fn(),
  loadHomePageData: vi.fn(),
  loadHomeProducts: vi.fn(),
  loadOneSectionProducts: vi.fn(),
  resolveTextLocale: vi.fn(),
  loadLocaleSet: vi.fn(),
  requirePublishedTextLocale: vi.fn(),
  loadSections: vi.fn(),
  loadSectionBySlug: vi.fn(),
  optionalSessionUserId: vi.fn(),
  quoteCartFor: vi.fn(),
  quoteCheckoutFor: vi.fn(),
  placeOrderFor: vi.fn(),
}));
const payload = vi.hoisted(() => ({ loadProductListPayload: vi.fn() }));

// Білдер — тотожність над хендлером: перевіряємо тіло serverFn, не RPC Start.
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    const builder = {
      validator: () => builder,
      handler: (fn: unknown) => fn,
    };
    return builder;
  },
}));
vi.mock('simplycms/storefront/loaders', () => loaders);
vi.mock('../server/product-list-payload', () => payload);

import { getProduct } from '../server/products';
import {
  getCatalogPageData,
  getCatalogProducts,
  getSectionPageData,
} from '../server/catalog';
import { quoteCart } from 'simplycms/core/lib/cart-quote';
import { quoteCheckout } from '../server/checkout-quote';
import { placeOrder } from '../server/checkout';
import { getPropertyOption } from '../server/properties';
import {
  getFeaturedProducts,
  getHomePageData,
  getNewProducts,
  getSectionProducts,
} from '../server/home';

type Call = (arg: { data?: unknown }) => Promise<unknown>;
const call = (fn: unknown, data?: unknown) => (fn as Call)({ data });
const SECTION = { id: 's1', name: 'Панелі', slug: 'paneli' };
/** Мінімальне валідне тіло оформлення (без items і locale — їх додає кейс). */
const ORDER = {
  firstName: 'Тест',
  lastName: 'Покупець',
  email: '',
  phone: '+380000000000',
  shippingMethodId: '10000009-0000-4000-8000-000000000001',
  deliveryCity: null,
  deliveryAddress: null,
  pickupPointId: null,
  paymentMethod: 'cash',
  notes: null,
  hasDifferentRecipient: false,
  recipientFirstName: null,
  recipientLastName: null,
  recipientPhone: null,
  recipientEmail: null,
  recipientCity: null,
  recipientAddress: null,
  recipientNotes: null,
  saveRecipient: false,
  savedRecipientId: null,
  savedAddressId: null,
};

beforeEach(() => {
  for (const fn of Object.values(loaders)) fn.mockReset();
  payload.loadProductListPayload.mockReset();
  loaders.resolveTextLocale.mockResolvedValue(TEXT);
  // Сторінка товару бере основну мову з кешу мов до транзакції (Task 17б fix-1, I1).
  loaders.loadLocaleSet.mockResolvedValue({
    primary: 'uk',
    published: ['uk', 'en'],
    known: ['uk', 'en'],
  });
  loaders.requirePublishedTextLocale.mockResolvedValue(TEXT);
  loaders.optionalSessionUserId.mockResolvedValue(null);
  loaders.withStorefrontDb.mockImplementation(
    async (fn: (db: unknown) => unknown) => fn(TX),
  );
  loaders.withViewerDb.mockImplementation(
    async (fn: (db: unknown, viewer: unknown) => unknown) => fn(TX, VIEWER),
  );
});

describe('serverFn вітрини з цінами — через withViewerDb (Р29)', () => {
  it.each([
    [
      'getProduct',
      () => call(getProduct, { locale: 'uk', path: 'x' }),
      'loadProduct',
      [TX, { locale: 'uk', path: 'x' }, VIEWER, 'uk'],
    ],
    [
      'getCatalogProducts',
      () => call(getCatalogProducts, { sectionId: 's1', locale: 'en' }),
      'loadCatalogProducts',
      [TX, VIEWER, TEXT, 's1'],
    ],
    [
      'getPropertyOption',
      () =>
        call(getPropertyOption, {
          propertySlug: 'p',
          optionSlug: 'o',
          locale: 'en',
        }),
      'loadPropertyOption',
      [TX, 'p', 'o', VIEWER, TEXT],
    ],
    [
      'getHomePageData',
      () => call(getHomePageData, { locale: 'en' }),
      'loadHomePageData',
      [TX, VIEWER, TEXT],
    ],
    [
      'getFeaturedProducts',
      () => call(getFeaturedProducts, { locale: 'en' }),
      'loadHomeProducts',
      [TX, true, VIEWER, TEXT],
    ],
    [
      'getNewProducts',
      () => call(getNewProducts, { locale: 'en' }),
      'loadHomeProducts',
      [TX, false, VIEWER, TEXT],
    ],
    [
      'getSectionProducts',
      () => call(getSectionProducts, { ...SECTION, locale: 'en' }),
      'loadOneSectionProducts',
      [TX, SECTION, VIEWER, TEXT],
    ],
  ] as const)('%s', async (_name, run, loader, args) => {
    await run();
    // Мова входу (`en`) мусить дійти до `resolveTextLocale`: інакше сторінка /en показала б
    // тексти основної мови (мутація «хендлер ігнорує locale» червоніє тут).
    if (_name !== 'getProduct')
      expect(loaders.resolveTextLocale).toHaveBeenCalledWith('en');
    expect(loaders.withViewerDb).toHaveBeenCalledTimes(1);
    expect(loaders.withStorefrontDb).not.toHaveBeenCalled();
    expect(loaders[loader]).toHaveBeenCalledWith(...args);
  });
});

describe('serverFn без цін та оформлення — мова входу доходить до визначення мови читання', () => {
  const items = [
    {
      productId: '10000002-0000-4000-8000-000000000001',
      modificationId: null,
      quantity: 1,
    },
  ];

  it('getCatalogPageData / getSectionPageData → resolveTextLocale("en"), текст мови — у списку', async () => {
    loaders.loadSections.mockResolvedValue([]);
    loaders.loadSectionBySlug.mockResolvedValue({ id: 's1' });
    await call(getCatalogPageData, { locale: 'en' });
    await call(getSectionPageData, { locale: 'en', slug: 'paneli' });
    expect(loaders.resolveTextLocale).toHaveBeenCalledTimes(2);
    expect(loaders.resolveTextLocale).toHaveBeenNthCalledWith(1, 'en');
    expect(loaders.resolveTextLocale).toHaveBeenNthCalledWith(2, 'en');
    expect(payload.loadProductListPayload).toHaveBeenNthCalledWith(1, TX, TEXT);
    expect(payload.loadProductListPayload).toHaveBeenNthCalledWith(
      2,
      TX,
      TEXT,
      's1',
    );
  });

  it('quoteCart → resolveTextLocale("en") і quoteCartFor(…, TEXT)', async () => {
    await call(quoteCart, { items, locale: 'en' });
    expect(loaders.resolveTextLocale).toHaveBeenCalledWith('en');
    expect(loaders.quoteCartFor).toHaveBeenCalledWith(items, null, TEXT);
  });

  it('quoteCheckout → resolveTextLocale("en") і quoteCheckoutFor(…, TEXT)', async () => {
    await call(quoteCheckout, { ...ORDER, items, locale: 'en' });
    expect(loaders.resolveTextLocale).toHaveBeenCalledWith('en');
    expect(loaders.quoteCheckoutFor.mock.calls[0]![2]).toBe(TEXT);
  });

  it('placeOrder → requirePublishedTextLocale("en") (відмова на межі) і placeOrderFor(…, TEXT)', async () => {
    await call(placeOrder, { ...ORDER, items, locale: 'en' });
    expect(loaders.requirePublishedTextLocale).toHaveBeenCalledWith('en');
    expect(loaders.resolveTextLocale).not.toHaveBeenCalled();
    expect(loaders.placeOrderFor.mock.calls[0]![2]).toBe(TEXT);
  });
});
