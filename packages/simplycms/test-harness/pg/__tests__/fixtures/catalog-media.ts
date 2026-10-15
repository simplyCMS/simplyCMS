// Фікстури фото каталогу (К3-Е6д-1): БД відгуків (свій `MEDIA_ROOT`) +
// сіятелі товару, розділу, властивості, опції й модифікації та завантаження
// файлу з власником — як це робить адмінський `uploadMedia`.
import { withActor } from 'simplycms/db';
import { writeMedia } from 'simplycms/storage';
import {
  insertProductGraph,
  modificationGraphSql,
  viaRows,
} from './product-graph';
import { useReviewsDb } from './reviews';

export function useCatalogMediaDb(prefix: string) {
  const d = useReviewsDb(prefix);
  const { f } = d;
  let n = 0;
  const tag = () => `${Date.now().toString(36)}${n++}`;

  /** Файл + рядок `media` з власником (`entityType`/`entityId`). */
  const upload = async (entityType: string, entityId: string, i = 0) =>
    (
      await withActor({ role: 'app_admin' }, (db) =>
        writeMedia(db, {
          bytes: Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, i, n++]),
          mime: 'image/png',
          entityType,
          entityId,
          uploadedBy: null,
        }),
      )
    ).ref;

  const product = async (images: string[] = []) => {
    const id = crypto.randomUUID();
    await insertProductGraph(
      viaRows((sql) => f.rows(sql)),
      {
        id,
        slug: `cm-${tag()}`,
        name: 'Товар',
        images,
      },
    );
    return id;
  };
  const modification = async (productId: string, images: string[] = []) => {
    const id = crypto.randomUUID();
    await f.rows(
      modificationGraphSql(productId, {
        id,
        slug: `cm-${tag()}`,
        name: 'Мод',
        images,
      }),
    );
    return id;
  };
  const section = async (imageUrl: string | null = null) => {
    const id = crypto.randomUUID();
    await f.rows(
      `insert into public.sections (id, slug, name, image_url) values ($1, $2, 'Розділ', $3)`,
      [id, `cm-${tag()}`, imageUrl],
    );
    return id;
  };
  const property = async (sectionId: string | null = null) => {
    const id = crypto.randomUUID();
    await f.rows(
      `insert into public.section_properties (id, section_id, name, slug)
       values ($1, $2, 'Властивість', $3)`,
      [id, sectionId, `cm-${tag()}`],
    );
    return id;
  };
  const option = async (propertyId: string, withPhoto = true) => {
    const id = crypto.randomUUID();
    const ref = withPhoto ? await upload('property_option', id) : null;
    await f.rows(
      `insert into public.property_options (id, property_id, name, slug, image_url)
       values ($1, $2, 'Опція', $3, $4)`,
      [id, propertyId, `cm-${tag()}`, ref],
    );
    return { id, ref };
  };
  const column = async (table: string, id: string, col: string) =>
    (
      await f.rows<Record<string, unknown>>(
        `select ${col} as v from public.${table} where id = $1`,
        [id],
      )
    )[0]?.v;

  return {
    ...d,
    upload,
    product,
    modification,
    section,
    property,
    option,
    column,
  };
}
