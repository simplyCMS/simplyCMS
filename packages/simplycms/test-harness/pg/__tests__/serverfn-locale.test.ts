// М1 Task 16 (фікс-раунд 1, I1/I2): ланка «serverFn → resolveTextLocale → лоадер» на справжніх
// хендлерах проти живого Postgres. `createServerFn` замінено тотожним білдером (валідатор
// виконується, RPC немає), `resolveTextLocale` НЕ мокається: мова входу реально доходить до
// лоадера, а чернеткова/невідома мова — ні.
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it, vi } from 'vitest';

type Parser = { parse: (v: unknown) => unknown };
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    let parser: Parser | undefined;
    const builder = {
      validator: (p: Parser) => {
        parser = p;
        return builder;
      },
      handler:
        (fn: (a: { data: unknown }) => unknown) =>
        async (arg?: { data?: unknown }) =>
          fn({ data: parser ? parser.parse(arg?.data) : arg?.data }),
    };
    return builder;
  },
}));
vi.mock('@tanstack/react-start/server', () => ({
  getRequest: () => new Request('http://localhost/'),
  setResponseHeader: vi.fn(),
  setResponseStatus: vi.fn(),
}));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig<typeof import('simplycms/auth')>()),
  readSessionSubject: vi.fn(async () => null),
}));

import { resolveTextLocale } from 'simplycms/storefront/loaders';
import {
  getCatalogPageData,
  getCatalogProducts,
  getSectionPageData,
} from '../../../src/storefront-routes/server/catalog';
import {
  getFeaturedProducts,
  getHomePageData,
  getNewProducts,
  getSectionProducts,
} from '../../../src/storefront-routes/server/home';
import { getPropertyOption } from '../../../src/storefront-routes/server/properties';
import { quoteCart } from '../../../src/core/lib/cart-quote';
import { quoteCheckout } from '../../../src/storefront-routes/server/checkout-quote';
import { placeOrder } from '../../../src/storefront-routes/server/checkout';
import { useCommerceDb, line } from './fixtures/commerce-db';
import { orderInput } from './fixtures/orders';
import { poll } from './fixtures/poll';
import { productGraphSql, sqlRef } from './fixtures/product-graph';

type Call<T = unknown> = (arg: { data: unknown }) => Promise<T>;
const call = <T = unknown>(fn: unknown, data: unknown) =>
  (fn as Call<T>)({ data });
type Named = { id: string; name: string };
const nameOf = (rows: Named[], id: string) =>
  rows.find((r) => r.id === id)?.name;

describe('serverFn вітрини: мова входу доходить до лоадера (Task 16, I1/I2)', () => {
  const db = useCommerceDb('simplycms_serverfn_locale');
  const product = randomUUID();
  const SECTION_SLUG = 'sonyachni-paneli';
  let section: { id: string; name: string; slug: string };

  beforeAll(async () => {
    await db.language('en');
    // Чернетка з рядками проєкції: інакше тест захисту був би порожнім за побудовою.
    await db.language('de', 'draft');
    await db.run(
      `update public.section_properties set has_page = true where slug = 'tip-paneli'`,
    );
    await db.run(
      productGraphSql({
        id: product,
        slug: 'kabel-serverfn',
        name: 'Кабель',
        translations: { en: { name: 'Cable' }, de: { name: 'Kabel' } },
        sectionId: sqlRef(
          `(select id from public.sections where slug = '${SECTION_SLUG}')`,
        ),
        isActive: true,
        isFeatured: true,
        hasModifications: false,
        stockStatus: 'in_stock',
        values: [
          {
            id: randomUUID(),
            propertyId: sqlRef(
              `(select id from public.section_properties where slug = 'tip-paneli')`,
            ),
            kind: 'select',
            optionId: sqlRef(
              `(select po.id from public.property_options po
                 join public.section_properties sp on sp.id = po.property_id
                where sp.slug = 'tip-paneli' and po.slug = 'mono')`,
            ),
          },
        ],
      }),
    );
    await db.run(
      `insert into public.product_prices (id, price_type_id, product_id, modification_id, price)
       select gen_random_uuid(), t.id, '${product}', null, 70 from public.price_types t where t.is_default`,
    );
    [section] = (await db.run(
      `select id, name, slug from public.sections where slug = '${SECTION_SLUG}'`,
    )) as (typeof section)[];
  });

  describe('читання: лістинги, головна, властивості', () => {
    it('getCatalogPageData / getSectionPageData: назва en', async () => {
      const all = await call<{ products: { items: Named[] } }>(
        getCatalogPageData,
        { locale: 'en' },
      );
      expect(nameOf(all.products.items, product)).toBe('Cable');
      const one = await call<{ products: { items: Named[] } } | null>(
        getSectionPageData,
        { slug: SECTION_SLUG, locale: 'en' },
      );
      expect(nameOf(one!.products.items, product)).toBe('Cable');
    });

    it('getCatalogProducts / getPropertyOption: назва en', async () => {
      const rows = await call<Named[]>(getCatalogProducts, { locale: 'en' });
      expect(nameOf(rows, product)).toBe('Cable');
      const page = await call<{ products: Named[] } | null>(getPropertyOption, {
        propertySlug: 'tip-paneli',
        optionSlug: 'mono',
        locale: 'en',
      });
      expect(nameOf(page!.products, product)).toBe('Cable');
    });

    it('головна: getHomePageData / getFeaturedProducts / getNewProducts / getSectionProducts — назва en', async () => {
      const home = await call<{
        featuredProducts: Named[];
        newProducts: Named[];
      }>(getHomePageData, { locale: 'en' });
      expect(nameOf(home.featuredProducts, product)).toBe('Cable');
      expect(nameOf(home.newProducts, product)).toBe('Cable');
      expect(
        nameOf(await call(getFeaturedProducts, { locale: 'en' }), product),
      ).toBe('Cable');
      expect(
        nameOf(await call(getNewProducts, { locale: 'en' }), product),
      ).toBe('Cable');
      expect(
        nameOf(
          await call(getSectionProducts, { ...section, locale: 'en' }),
          product,
        ),
      ).toBe('Cable');
    });

    it('основна мова на тих самих функціях — назва uk (контроль: мова справді міняє відповідь)', async () => {
      expect(
        nameOf(await call(getCatalogProducts, { locale: 'uk' }), product),
      ).toBe('Кабель');
    });
  });

  describe('кошик і оформлення', () => {
    const order = () => ({
      ...orderInput(db.pickup, db.point, []),
      items: [line(product, 1)],
    });
    const orderItemNames = async () =>
      (
        (await db.run(
          `select name from public.order_items where product_id = '${product}' order by created_at`,
        )) as { name: string }[]
      ).map((r) => r.name);

    it('quoteCart: назва рядка en', async () => {
      const q = await call<{ lines: { name: string }[] }>(quoteCart, {
        items: [line(product, 1)],
        locale: 'en',
      });
      expect(q.lines[0]!.name).toBe('Cable');
    });

    it('quoteCheckout: назва позиції en', async () => {
      const r = await call<{ ok: boolean; quote: { items: Named[] } }>(
        quoteCheckout,
        { ...order(), locale: 'en' },
      );
      expect(r.ok && r.quote.items[0]!.name).toBe('Cable');
    });

    it('placeOrder: знімок order_items.name — en; мова draft → відмова валідації, знімка немає', async () => {
      const placed = await call<{ ok: boolean }>(placeOrder, {
        ...order(),
        locale: 'en',
      });
      expect(placed.ok).toBe(true);
      expect(await orderItemNames()).toEqual(['Cable']);
      // Фонова доставка листа тримає зʼєднання: дочекатись, щоб видалення БД не обірвало його.
      await poll('лист оформлення доставлено', async () => {
        const [{ n }] = (await db.run(
          `select count(*)::int as n from public.mail_outbox where attempts = 0`,
        )) as { n: number }[];
        return n === 0 ? true : undefined;
      });

      await expect(
        call(placeOrder, { ...order(), locale: 'de' }),
      ).rejects.toMatchObject({ name: 'ValidationError' });
      expect(await orderItemNames()).toEqual(['Cable']);
    });
  });

  describe('недовірена мова входу (I2)', () => {
    it('resolveTextLocale: published → вона ж; draft, невідома, undefined → основна', async () => {
      expect(await resolveTextLocale('en')).toEqual({
        locale: 'en',
        primary: 'uk',
      });
      for (const bad of ['de', 'xx', undefined])
        expect(await resolveTextLocale(bad)).toEqual({
          locale: 'uk',
          primary: 'uk',
        });
    });

    it('читання з мовою draft (у якої Є рядки проєкції) віддає основну мову, а не чернетку чи порожньо', async () => {
      const rows = await call<Named[]>(getCatalogProducts, { locale: 'de' });
      expect(nameOf(rows, product)).toBe('Кабель');
      const q = await call<{ lines: { name: string }[] }>(quoteCart, {
        items: [line(product, 1)],
        locale: 'de',
      });
      expect(q.lines[0]!.name).toBe('Кабель');
    });

    it('locale неправильної форми відхиляє валідатор serverFn', async () => {
      await expect(
        call(getCatalogProducts, { locale: 'не мова' }),
      ).rejects.toMatchObject({ name: 'ZodError' });
      await expect(
        call(getCatalogProducts, { locale: 'en'.repeat(40) }),
      ).rejects.toMatchObject({ name: 'ZodError' });
    });
  });
});
