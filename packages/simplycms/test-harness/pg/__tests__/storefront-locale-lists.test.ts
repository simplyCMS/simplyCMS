// М1 Task 16 (П7, рішення архітектора поб.1 Task 15) проти живого Postgres: лістинги, головна
// й сторінка значення характеристики читають назву й адресу товару мовою запиту з проєкції
// `catalog_product_texts`; неперекладене — з основної мови з ознакою `lang`.
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  loadCatalogProducts,
  loadHomePageData,
  loadHomeProducts,
  loadOneSectionProducts,
  loadProductList,
  loadPropertyOption,
  loadRootSections,
} from 'simplycms/storefront/loaders';
import { withViewerPricesDb } from '../../../src/storefront/loaders/viewer-prices-db';
import { useAddressingDb } from './fixtures/addressing-db';
import { productsSetPath } from 'simplycms/admin-server/impl';
import { create, exec } from './fixtures/product-aggregate';
import { valueGraphSql } from './fixtures/product-graph';
import { EN, UK } from './fixtures/text-locale';

describe('читачі товару: лістинг, головна, значення характеристики на /en (Task 16)', () => {
  const db = useAddressingDb('simplycms_lists_locale');
  const sectionId = randomUUID();
  const property = randomUUID();
  const option = randomUUID();
  let cable: { id: string; version: number; paths: Record<string, string> };
  let socket: { id: string; paths: Record<string, string> };

  beforeAll(async () => {
    await db.language('en');
    // Чернетка мови ДО створення товарів: проєкція тоді МАЄ її рядки, тож тест видимості
    // червоніє без предиката `published`, а не порожній через відсутність рядків.
    await db.language('de', 'draft');
    await db.q(
      `insert into public.sections (id, slug, name, sort_order, is_active)
       values ($1, 'kabeli', 'Кабелі', 1, true)`,
      [sectionId],
    );
    await db.q(
      `insert into public.section_properties (id, name, slug, property_type, has_page)
       values ($1, 'Тип', 'typ', 'select', true)`,
      [property],
    );
    await db.q(
      `insert into public.property_options (id, property_id, name, slug)
       values ($1, $2, 'Мідний', 'midnyi')`,
      [option, property],
    );
    // Перекладений: назва, короткий опис і адреса en відрізняються від uk.
    cable = await create(
      {
        uk: { name: 'Кабель', shortDescription: 'Мідний кабель' },
        en: { name: 'Cable', shortDescription: 'Copper cable' },
      },
      { sectionId, isFeatured: true },
    );
    // Адреса en — власна (нова за замовчуванням збігається з основною): картка має вести саме на неї.
    await exec(productsSetPath, {
      id: cable.id,
      locale: 'en',
      path: 'cable',
      expectedVersion: cable.version,
    });
    cable.paths.en = 'cable';
    // Лише основна мова: en читається з fallback, адреса en — за назвою основної.
    socket = await create(
      { uk: { name: 'Розетка', shortDescription: 'Подвійна розетка' } },
      { sectionId, isFeatured: true },
    );
    await db.q(
      valueGraphSql(
        { kind: 'product', id: cable.id },
        {
          id: randomUUID(),
          propertyId: property,
          kind: 'select',
          optionId: option,
        },
      ),
    );
  });

  const view = <T>(
    run: (
      tx: Parameters<Parameters<typeof withViewerPricesDb>[1]>[0],
      v: Parameters<Parameters<typeof withViewerPricesDb>[1]>[1],
    ) => Promise<T>,
  ) => withViewerPricesDb(null, run);
  const bySlug = <T extends { slug: string }>(rows: T[], slug: string) =>
    rows.find((r) => r.slug === slug);

  it('лістинг /en розділу: назва en або fallback, посилання /en/<path>', async () => {
    const list = await view((tx, v) => loadProductList(tx, v, EN, sectionId));

    // Картка веде на адресу ЦІЄЇ мови, не основної (рішення архітектора, поб.1 Task 15).
    expect(paths(cable).en).not.toBe(paths(cable).uk);
    expect(list.find((r) => r.id === cable.id)).toMatchObject({
      name: 'Cable',
      slug: paths(cable).en,
      name_lang: null,
    });
    // Неперекладене — назва основної мови з `lang` основної, адреса en з реєстру.
    expect(list.find((r) => r.id === socket.id)).toMatchObject({
      name: 'Розетка',
      slug: paths(socket).en,
      name_lang: 'uk',
    });
    expect(bySlug(list, paths(cable).uk)).toBeUndefined();
  });

  it('той самий розділ основною мовою: назва і адреса uk, жодного lang', async () => {
    const list = await view((tx, v) => loadProductList(tx, v, UK, sectionId));
    expect(list.find((r) => r.id === cable.id)).toMatchObject({
      name: 'Кабель',
      slug: paths(cable).uk,
      name_lang: null,
    });
  });

  it('вибірка каталогу /en: назва, адреса й короткий опис мовою запиту з ознаками fallback', async () => {
    const rows = await view((tx, v) =>
      loadCatalogProducts(tx, v, EN, sectionId),
    );
    expect(rows.find((r) => r.id === cable.id)).toMatchObject({
      name: 'Cable',
      slug: paths(cable).en,
      short_description: 'Copper cable',
      name_lang: null,
      short_description_lang: null,
    });
    expect(rows.find((r) => r.id === socket.id)).toMatchObject({
      name: 'Розетка',
      short_description: 'Подвійна розетка',
      name_lang: 'uk',
      short_description_lang: 'uk',
    });
  });

  it('головна /en: добірки й каруселі розділів — назва та адреса en, fallback з lang', async () => {
    const featured = await view((tx, v) => loadHomeProducts(tx, true, v, EN));
    expect(featured.find((r) => r.id === cable.id)).toMatchObject({
      name: 'Cable',
      slug: paths(cable).en,
      short_description: 'Copper cable',
      name_lang: null,
    });
    expect(featured.find((r) => r.id === socket.id)).toMatchObject({
      name_lang: 'uk',
      short_description_lang: 'uk',
    });

    const home = await view((tx, v) => loadHomePageData(tx, v, EN));
    const carousel = home.sectionProducts[sectionId] ?? [];
    expect(carousel.find((r) => r.id === cable.id)?.slug).toBe(paths(cable).en);

    const section = (await view((tx) => loadRootSections(tx))).find(
      (s) => s.id === sectionId,
    )!;
    const one = await view((tx, v) =>
      loadOneSectionProducts(tx, section, v, EN),
    );
    expect(one.find((r) => r.id === cable.id)?.name).toBe('Cable');
  });

  it('сторінка значення характеристики /en: товари з назвою й адресою en', async () => {
    const page = await view((tx, v) =>
      loadPropertyOption(tx, 'typ', 'midnyi', v, EN),
    );
    expect(page?.products.find((r) => r.id === cable.id)).toMatchObject({
      name: 'Cable',
      slug: paths(cable).en,
    });
  });

  it('мова draft не показується у вітрині: рядки проєкції є, але список порожній (pageVisible)', async () => {
    const rows = await db.q(
      `select 1 from public.catalog_product_texts where locale = 'de' and product_id = $1`,
      [cable.id],
    );
    expect(rows).toHaveLength(1);
    const draft = { locale: 'de', primary: 'uk' };
    expect(
      await view((tx, v) => loadProductList(tx, v, draft, sectionId)),
    ).toEqual([]);
    expect(
      await view((tx, v) => loadCatalogProducts(tx, v, draft, sectionId)),
    ).toEqual([]);
    expect(await view((tx, v) => loadHomeProducts(tx, true, v, draft))).toEqual(
      [],
    );
  });
});

const paths = (p: { paths: Record<string, string> }) => p.paths;
