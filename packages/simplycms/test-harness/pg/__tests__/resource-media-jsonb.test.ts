// К3-Е6д-1: медіа на jsonb-масиві референсів у фабриці — каскад видалення товару:
// рядок `media` у транзакції, файл після COMMIT.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { productsOps as ops } from 'simplycms/admin-server/impl';
import { useCatalogMediaDb } from './fixtures/catalog-media';
import {
  insertProductGraph,
  modificationGraphSql,
  viaRows,
} from './fixtures/product-graph';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: null, roles: ['admin'] },
    scope: 'any',
  })),
}));

describe('фабрика: media на jsonb-масиві (К3-Е6д-1)', () => {
  const d = useCatalogMediaDb('simplycms_e6d_media_jsonb');
  afterEach(() => vi.restoreAllMocks());

  // Запис jsonb-масиву фото через `media` фабрики мав лише товар (`products.images`, знесено
  // в М1 Task 17: фото — рядки `product_images` команди агрегата). jsonb-гілка лишається в
  // каскаді: фото відгуків (`product_reviews.images`) стираються з видаленням товару.
  it('remove товару стирає фото товару, його модифікацій і відгуків (файли — після COMMIT)', async () => {
    const id = crypto.randomUUID();
    const own = await d.upload('product', id);
    // Файл фото модифікації належить ТОВАРУ (власник медіа — товар, М1 Task 12).
    const modPhoto = await d.upload('product', id, 1);
    await insertProductGraph(
      viaRows((sql) => d.f.rows(sql)),
      {
        id,
        slug: `jb-${id.slice(0, 8)}`,
        name: 'Т',
        images: [own],
      },
    );
    await d.f.rows(
      modificationGraphSql(id, {
        id: crypto.randomUUID(),
        slug: 'm1',
        name: 'Мод',
        images: [modPhoto],
      }),
    );
    const reviewId = await d.seedReview({ productId: id });
    const [revPhoto] = await d.seedPhotos(reviewId, 1);
    await expect(ops.remove({ data: [{ id }] })).resolves.toEqual({ count: 1 });
    for (const k of [own, modPhoto, revPhoto!]) {
      expect(await d.mediaRows(k)).toHaveLength(0);
      expect(d.hasFile(k)).toBe(false);
    }
  });
});
