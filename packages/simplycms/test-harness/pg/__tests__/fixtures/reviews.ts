// Фікстури модерації відгуків (К3-Е6д, Task 6): БД із товарами + тимчасовий
// `MEDIA_ROOT` (`useDeleteDb`) і хелпери рядків відгуку та їхніх фото.
import { withActor } from 'simplycms/db';
import { getMediaDriver, writeMedia } from 'simplycms/storage';
import { useDeleteDb } from './customer-delete';

export type SeedReview = {
  id?: string;
  userId?: string | null;
  productId?: string;
  rating?: number;
  status?: string;
  createdAt?: string;
  content?: string | null;
  adminComment?: string | null;
  /** `undefined` — колонка за замовчуванням; `null` — SQL NULL; решта — jsonb. */
  images?: unknown;
};

export function useReviewsDb(prefix: string) {
  const d = useDeleteDb(prefix);
  const { f } = d;

  const seedUser = async (name: string, profile?: [string, string]) => {
    const id = crypto.randomUUID();
    await f.rows(
      `insert into public.users (id, name, email) values ($1, $2, $3)`,
      [id, name, `rv-${id.slice(0, 8)}@example.test`],
    );
    if (profile)
      await f.rows(
        `insert into public.profiles (id, user_id, email, first_name, last_name)
         values (gen_random_uuid(), $1, $2, $3, $4)`,
        [id, `rv-${id.slice(0, 8)}@example.test`, ...profile],
      );
    return id;
  };

  const seedReview = async (o: SeedReview = {}) => {
    const id = o.id ?? crypto.randomUUID();
    const images =
      o.images === undefined
        ? '[]'
        : o.images === null
          ? null
          : JSON.stringify(o.images);
    await f.rows(
      `insert into public.product_reviews
         (id, product_id, user_id, rating, status, created_at, content, admin_comment, images)
       values ($1, $2, $3, $4, $5, coalesce($6::timestamptz, now()), $7, $8, $9::jsonb)`,
      [
        id,
        o.productId ?? f.ids.panel,
        o.userId ?? null,
        o.rating ?? 4,
        o.status ?? 'pending',
        o.createdAt ?? null,
        o.content ?? null,
        o.adminComment ?? null,
        images,
      ],
    );
    return id;
  };

  /** Фото відгуку: файл на диску + рядок `media` (`entity_type = 'review'`). */
  const seedPhotos = async (reviewId: string, n: number) => {
    const refs: string[] = [];
    for (let i = 0; i < n; i++) {
      const rec = await withActor({ role: 'app_admin' }, (db) =>
        writeMedia(db, {
          bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, i]),
          mime: 'image/png',
          entityType: 'review',
          entityId: reviewId,
          uploadedBy: null,
        }),
      );
      refs.push(rec.ref);
    }
    await f.rows(
      `update public.product_reviews set images = $2::jsonb where id = $1`,
      [reviewId, JSON.stringify(refs)],
    );
    return refs;
  };

  const status = async (id: string) =>
    (
      await f.one<{ status: string }>(
        `select status from public.product_reviews where id = $1`,
        [id],
      )
    ).status;
  /** Версія рядка так, як її бачить модератор (мс, UTC) — `updatedAt` картки. */
  const version = async (id: string) =>
    (
      await f.one<{ v: string }>(
        `select to_char(date_trunc('milliseconds', updated_at) at time zone 'utc',
                'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as v
           from public.product_reviews where id = $1`,
        [id],
      )
    ).v;
  /** `items` для `setReviewsStatus` з поточних версій; невідомий id — «зараз». */
  const items = (ids: string[]) =>
    Promise.all(
      ids.map(async (id) => ({
        id,
        updatedAt: (await exists(id))
          ? await version(id)
          : new Date().toISOString(),
      })),
    );
  const exists = async (id: string) =>
    (await d.count('product_reviews', 'id = $1', [id])) === 1;

  return {
    ...d,
    seedUser,
    seedReview,
    seedPhotos,
    status,
    version,
    items,
    exists,
    getMediaDriver,
  };
}
