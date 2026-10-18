// М1 Task 17б фікс-раунд 1 (I2) проти живого Postgres: рядок квоти кошика несе мініатюру
// мовою запиту тим самим читачем, що сторінка товару (`lineImageSql` ← галерея
// модифікації, інакше товару): перевизначення файлу мови, alt мови, fallback alt з `lang`.
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { resolveMediaUrl } from 'simplycms/domain/media';
import { quoteCartFor } from 'simplycms/storefront/loaders';
import { useCommerceDb, line } from './fixtures/commerce-db';
import { productGraphSql } from './fixtures/product-graph';
import { EN, UK } from './fixtures/text-locale';

const url = (key: string) => resolveMediaUrl(key)!;

describe('мініатюра позиції кошика мовою сторінки (Task 17б fix-1)', () => {
  const db = useCommerceDb('simplycms_cart_image');
  const product = randomUUID();
  const red = randomUUID();
  const blue = randomUUID();

  /** Переклад фото за ключем: `[мова, alt, файл мови]`. */
  const translate = (key: string, locale: string, alt: string, file?: string) =>
    db.run(
      `insert into public.product_image_translations (image_id, locale, alt, storage_key)
       select id, '${locale}', '${alt}', ${file ? `'${file}'` : 'null'}
         from public.product_images where storage_key = '${key}'`,
    );

  beforeAll(async () => {
    await db.language('en');
    await db.run(
      productGraphSql({
        id: product,
        slug: 'kabel-foto',
        name: 'Кабель',
        translations: { en: { name: 'Cable' } },
        isActive: true,
        hasModifications: true,
        stockStatus: 'in_stock',
        images: ['ci/main.png', 'ci/back.png'],
        modifications: [
          {
            id: red,
            slug: 'chervonyi',
            name: 'Червоний',
            isDefault: true,
            images: ['ci/red.png'],
          },
          // Без власних фото: мініатюра — головне фото товару.
          { id: blue, slug: 'synii', name: 'Синій' },
        ],
      }),
    );
    await translate('ci/main.png', 'uk', 'Кабель спереду');
    await translate('ci/main.png', 'en', 'Cable front', 'ci/main-en.png');
    // Фото модифікації з alt лише основною мовою: на /en — fallback з `lang`.
    await translate('ci/red.png', 'uk', 'Червоний кабель');
    for (const mod of [red, blue, null])
      await db.run(
        `insert into public.product_prices (id, price_type_id, product_id, modification_id, price)
         select gen_random_uuid(), t.id, '${product}', ${mod ? `'${mod}'` : 'null'}, 100
           from public.price_types t where t.is_default`,
      );
  });

  const imageOf = async (text: typeof UK, mod: string | null) => {
    const l = (await quoteCartFor([line(product, 1, mod)], null, text))
      .lines[0]!;
    if (!l.available) throw new Error('позиція недоступна');
    return l.image;
  };

  it('кошик на /en: перевизначене фото en і alt en (модифікація без фото → фото товару)', async () => {
    expect(await imageOf(EN, blue)).toEqual({
      url: url('ci/main-en.png'),
      alt: 'Cable front',
      alt_lang: null,
    });
    expect(await imageOf(EN, null)).toEqual({
      url: url('ci/main-en.png'),
      alt: 'Cable front',
      alt_lang: null,
    });
  });

  it('кошик на /: спільне фото й alt основної', async () => {
    expect(await imageOf(UK, blue)).toEqual({
      url: url('ci/main.png'),
      alt: 'Кабель спереду',
      alt_lang: null,
    });
  });

  it('фото модифікації пріоритетне; alt без перекладу en — основної з lang', async () => {
    expect(await imageOf(EN, red)).toEqual({
      url: url('ci/red.png'),
      alt: 'Червоний кабель',
      alt_lang: 'uk',
    });
  });

  it('кілька позицій — кожна своя мініатюра (один запит, ключ товар/модифікація)', async () => {
    const quote = await quoteCartFor(
      [line(product, 1, red), line(product, 1, blue)],
      null,
      EN,
    );
    expect(quote.lines.map((l) => (l.available ? l.image?.url : null))).toEqual(
      [url('ci/red.png'), url('ci/main-en.png')],
    );
  });
});
