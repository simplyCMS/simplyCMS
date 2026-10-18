// М1 Task 17б проти живого Postgres: вітрина показує фото товару й модифікації мовою
// сторінки — перевизначення файлу (`product_image_translations.storage_key`) і alt мови,
// fallback alt основної з ознакою мови з ДАНИХ, порожній alt без жодного перекладу. Один
// читач (`productGallerySql`/`modificationGallerySql` → `toGallery`) для сторінки, галереї
// модифікації й мініатюр лістингів; рендер галереї — з тих самих завантажених даних.
import { randomUUID } from 'node:crypto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it } from 'vitest';
import { resolveMediaUrl } from 'simplycms/domain/media';
import { I18nProvider } from 'simplycms/i18n';
import { ProductGallery } from 'simplycms/catalog-ui/ProductGallery';
import type { ProductImageViewModel } from 'simplycms/contracts/views';
import {
  loadCatalogProducts,
  loadHomePageData,
  loadHomeProducts,
  loadProduct,
  loadProductList,
} from 'simplycms/storefront/loaders';
import { withViewerPricesDb } from '../../../src/storefront/loaders/viewer-prices-db';
import { useAddressingDb } from './fixtures/addressing-db';
import { create } from './fixtures/product-aggregate';
import { EN, UK } from './fixtures/text-locale';

const url = (key: string) => resolveMediaUrl(key)!;

describe('фото товару мовою сторінки (Task 17б)', () => {
  const db = useAddressingDb('simplycms_image_locale');
  const sectionId = randomUUID();
  let cable: { id: string; paths: Record<string, string> };

  /** Фото товару (або модифікації) і його переклади: `[мова, alt, файл мови]`. */
  const image = async (
    key: string,
    sort: number,
    rows: [string, string | null, string | null][],
    modificationId: string | null = null,
  ) => {
    const id = randomUUID();
    await db.q(
      `insert into public.product_images (id, product_id, modification_id, storage_key, sort_order)
       values ($1, $2, $3, $4, $5)`,
      [id, cable.id, modificationId, key, sort],
    );
    for (const [locale, alt, override] of rows)
      await db.q(
        `insert into public.product_image_translations (image_id, locale, alt, storage_key)
         values ($1, $2, $3, $4)`,
        [id, locale, alt, override],
      );
  };

  let modification = '';
  beforeAll(async () => {
    await db.language('en');
    await db.q(
      `insert into public.sections (id, slug, name, sort_order, is_active)
       values ($1, 'kabeli', 'Кабелі', 1, true)`,
      [sectionId],
    );
    cable = await create(
      { uk: { name: 'Кабель' }, en: { name: 'Cable' } },
      { sectionId, isFeatured: true },
    );
    // Головне фото: alt обома мовами й власний файл en. Друге — alt лише основною
    // (на en — fallback з `lang`). Третє — без жодного alt (порожній, не назва).
    await image('ab/main.png', 0, [
      ['uk', 'Кабель спереду', null],
      ['en', 'Cable front', 'ab/main-en.png'],
    ]);
    await image('ab/back.png', 1, [['uk', 'Кабель ззаду', null]]);
    await image('ab/bare.png', 2, []);
    modification = await db.modification(cable.id);
    await image('ab/mod.png', 0, [['en', null, 'ab/mod-en.png']], modification);
  });

  const view = <T>(
    run: (
      tx: Parameters<Parameters<typeof withViewerPricesDb>[1]>[0],
      v: Parameters<Parameters<typeof withViewerPricesDb>[1]>[1],
    ) => Promise<T>,
  ) => withViewerPricesDb(null, run);
  const page = (locale: string) =>
    view((tx, v) => loadProduct(tx, { locale, path: cable.paths[locale]! }, v));
  const gallery = (images: ProductImageViewModel[]) =>
    renderToStaticMarkup(
      createElement(I18nProvider, {
        locale: 'en',
        children: createElement(ProductGallery, { images }),
      }),
    );

  it('сторінка /en: файл і alt en, fallback alt основної з lang, без alt — порожній', async () => {
    const product = await page('en');
    expect(product?.images).toEqual([
      { url: url('ab/main-en.png'), alt: 'Cable front', alt_lang: null },
      { url: url('ab/back.png'), alt: 'Кабель ззаду', alt_lang: 'uk' },
      { url: url('ab/bare.png'), alt: '', alt_lang: null },
    ]);
  });

  it('сторінка основною мовою: спільний файл і alt основної, жодного lang', async () => {
    const product = await page('uk');
    expect(product?.images).toEqual([
      { url: url('ab/main.png'), alt: 'Кабель спереду', alt_lang: null },
      { url: url('ab/back.png'), alt: 'Кабель ззаду', alt_lang: null },
      { url: url('ab/bare.png'), alt: '', alt_lang: null },
    ]);
  });

  it('галерея модифікації — той самий читач: перевизначення en на /en, спільне на /', async () => {
    const en = (await page('en'))?.product_modifications;
    const uk = (await page('uk'))?.product_modifications;
    expect(en?.find((m) => m.id === modification)?.images).toEqual([
      { url: url('ab/mod-en.png'), alt: '', alt_lang: null },
    ]);
    expect(uk?.find((m) => m.id === modification)?.images).toEqual([
      { url: url('ab/mod.png'), alt: '', alt_lang: null },
    ]);
  });

  it('мініатюри лістингів /en (SSR-список, каталог, головна, розділ головної) — перевизначення en', async () => {
    const first = (rows: { id: string; images: ProductImageViewModel[] }[]) =>
      rows.find((r) => r.id === cable.id)?.images[0];
    const front = { url: url('ab/main-en.png'), alt: 'Cable front' };

    expect(
      first(await view((tx, v) => loadProductList(tx, v, EN, sectionId))),
    ).toMatchObject(front);
    expect(
      first(await view((tx, v) => loadCatalogProducts(tx, v, EN, sectionId))),
    ).toMatchObject(front);
    expect(
      first(await view((tx, v) => loadHomeProducts(tx, true, v, EN))),
    ).toMatchObject(front);
    const home = await view((tx, v) => loadHomePageData(tx, v, EN));
    expect(first(home.sectionProducts[sectionId] ?? [])).toMatchObject(front);
    // Основною мовою мініатюра — спільний файл.
    expect(
      first(await view((tx, v) => loadProductList(tx, v, UK, sectionId))),
    ).toMatchObject({ url: url('ab/main.png'), alt: 'Кабель спереду' });
  });

  it('рендер галереї з даних /en: alt en; fallback — lang основної; без alt — alt=""', async () => {
    const images = (await page('en'))!.images;
    expect(gallery(images)).toContain(
      `src="${url('ab/main-en.png')}" alt="Cable front"`,
    );
    const fallback = gallery([images[1]!]);
    expect(fallback).toMatch(/<img [^>]*alt="Кабель ззаду" lang="uk"/);
    const bare = gallery([images[2]!]);
    expect(bare).toMatch(/<img [^>]*alt=""/);
    expect(bare).not.toMatch(/alt="(Cable|Кабель|ab\/bare\.png)/);
  });
});
