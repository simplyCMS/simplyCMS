// М1 Task 17б фікс-раунд 1 проти живого Postgres:
// - I1: галерея сторінки товару — у тому самому запиті, що й мовна версія (основна мова
//   відома ДО запиту з кешу мов), а не окремим походом;
// - M4: семантика alt — `''` у перекладі мови = явно декоративне (fallback НЕ застосовується),
//   `null`/рядка немає = перекладу немає (fallback на основну з `lang`); порожній alt мови
//   не має ніколи.
import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi, beforeAll } from 'vitest';
import { withActor } from 'simplycms/db';
import { toGallery } from 'simplycms/storefront/loaders';
import { loadProductPageBase } from '../../../src/storefront/loaders/product-page';
import { useAddressingDb } from './fixtures/addressing-db';
import { create } from './fixtures/product-aggregate';

describe('сторінка товару: галерея одним запитом і семантика alt (Task 17б fix-1)', () => {
  const db = useAddressingDb('simplycms_image_page');
  let product: { id: string; paths: Record<string, string> };

  /** Фото товару і його переклади alt: `[мова, alt]`. */
  const image = async (key: string, sort: number, alts: [string, string][]) => {
    const id = randomUUID();
    await db.q(
      `insert into public.product_images (id, product_id, storage_key, sort_order)
       values ($1, $2, $3, $4)`,
      [id, product.id, key, sort],
    );
    for (const [locale, alt] of alts)
      await db.q(
        `insert into public.product_image_translations (image_id, locale, alt)
         values ($1, $2, $3)`,
        [id, locale, alt],
      );
  };

  beforeAll(async () => {
    await db.language('en');
    product = await create({ uk: { name: 'Кабель' }, en: { name: 'Cable' } });
    // en явно декоративне (`''`), хоч основна має опис — fallback НЕ застосовується.
    await image('ab/decor.png', 0, [
      ['uk', 'Кабель спереду'],
      ['en', ''],
    ]);
    // Основна мова явно декоративна, en перекладу немає — fallback дає `''` без `lang`.
    await image('ab/plain.png', 1, [['uk', '']]);
  });

  /** Лоадер ядра сторінки під актором вітрини; `sent` — тексти SQL, що реально пішли в pg. */
  const loadCounted = (locale: string) =>
    withActor({ role: 'app_user' }, async (tx, client) => {
      const spy = vi.spyOn(client, 'query');
      try {
        const base = await loadProductPageBase(
          tx,
          { locale, path: product.paths[locale]! },
          'uk',
        );
        const sent = spy.mock.calls.map(([q]) =>
          typeof q === 'string' ? q : (q as { text: string }).text,
        );
        return { base, sent };
      } finally {
        spy.mockRestore();
      }
    });

  it('I1: два запити (сторінка з галереєю + мовні версії), фото — у запиті сторінки', async () => {
    const { base, sent } = await loadCounted('en');
    expect(sent).toHaveLength(2);
    const withImages = sent.filter((t) => t.includes('product_images'));
    expect(withImages).toHaveLength(1);
    // Той самий запит, що знаходить мовну версію за адресою (`catalog_product_texts`.path).
    expect(withImages[0]).toContain('"catalog_product_texts"."path"');
    expect(toGallery(base?.product.images)).toHaveLength(2);
  });

  it("M4: '' мови — декоративне без fallback; '' основної — порожній alt без lang", async () => {
    const { base } = await loadCounted('en');
    expect(toGallery(base?.product.images)).toEqual([
      expect.objectContaining({ alt: '', alt_lang: null }),
      expect.objectContaining({ alt: '', alt_lang: null }),
    ]);
    const { base: uk } = await loadCounted('uk');
    expect(toGallery(uk?.product.images)).toEqual([
      expect.objectContaining({ alt: 'Кабель спереду', alt_lang: null }),
      expect.objectContaining({ alt: '', alt_lang: null }),
    ]);
  });
});
