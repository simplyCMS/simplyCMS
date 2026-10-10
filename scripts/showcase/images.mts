/**
 * Зображення товарів сіду (С-5): PNG із PRNG → порт `simplycms/storage`.
 *
 * 🔴 Лише `writeMedia` з ЯВНИМ драйвером: рядок `media` і файл лягають одним
 * актом у транзакції викликача, а гейт засіває дві бази у дві різні
 * медіатеки — кешований `getMediaDriver()` писав би обидві в одну.
 */
import type { ActorDb } from '../../packages/simplycms/src/db/index.ts';
import { writeMedia } from '../../packages/simplycms/src/storage/index.ts';
import { pngBytes } from './png.mts';
import { int, type Rand } from './prng.mts';
import type { SeedContext } from './seed-context.mts';

/** Завантажує `count` PNG товару; повертає ref-и для колонки `images`. */
export async function uploadProductImages(
  db: ActorDb,
  ctx: SeedContext,
  rand: Rand,
  productId: string,
  count: number,
): Promise<string[]> {
  const refs: string[] = [];
  for (let i = 0; i < count; i++) {
    const seed = int(rand, 1, 2 ** 30);
    const record = await writeMedia(
      db,
      {
        bytes: pngBytes({ width: 480, height: 480, seed }),
        mime: 'image/png',
        entityType: 'product',
        entityId: productId,
        uploadedBy: ctx.ownerId,
      },
      ctx.media,
    );
    refs.push(record.ref);
  }
  return refs;
}
