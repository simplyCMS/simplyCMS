// Фікстури фото відгуків (К3-Е6д, Task 7): БД відгуків (`useReviewsDb`, свій
// `MEDIA_ROOT`) + знімок медіатеки й стану для асертів «нічого не лишилось».
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { useReviewsDb } from './reviews';

const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3];

/** Перевірений вміст PNG (як після `inspectUpload`); `i` робить байти різними. */
export const png = (i = 0) => ({
  bytes: Uint8Array.from([...PNG_HEAD, i]),
  mime: 'image/png' as const,
});

/** Той самий PNG як `File` форми. */
export const pngFile = (i = 0) =>
  new File([Uint8Array.from([...PNG_HEAD, i])], `p${i}.png`, {
    type: 'image/png',
  });

export type ReviewRow = {
  user_id: string | null;
  status: string;
  rating: number;
  title: string | null;
  images: string[] | null;
};

export function useReviewPhotosDb(prefix: string) {
  const d = useReviewsDb(prefix);
  const { f } = d;

  /** Усі опубліковані обʼєкти медіатеки (без тимчасових `.tmp-*`). */
  const diskKeys = (): string[] => {
    const root = d.state.root;
    if (!existsSync(root)) return [];
    return readdirSync(root, { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile() && !e.name.startsWith('.tmp-'))
      .map((e) => join(e.parentPath, e.name).slice(root.length + 1))
      .sort();
  };

  /** Рядки `media` фото відгуку: власник — `review`/`<id>`. */
  const reviewMedia = (reviewId: string) =>
    f.rows<{ storage_key: string; uploaded_by: string | null }>(
      `select storage_key, uploaded_by from public.media
        where entity_type = 'review' and entity_id = $1 order by storage_key`,
      [reviewId],
    );
  const mediaCount = () => d.count('media', 'true', []);
  const reviewRow = async (id: string) =>
    (
      await f.rows<ReviewRow>(
        `select user_id, status, rating, title, images
           from public.product_reviews where id = $1`,
        [id],
      )
    )[0];

  /** Відкладений тригер: падає на COMMIT, коли ядро вже відпрацювало. */
  const blockCommit = async (table: 'product_reviews' | 'users') => {
    await f.rows(
      `create or replace function public.e6d_commit_block() returns trigger
         language plpgsql as $$ begin raise exception 'commit blocked'; end $$`,
    );
    await f.rows(
      `create constraint trigger e6d_commit_block after delete on public.${table}
         deferrable initially deferred for each row
         execute function public.e6d_commit_block()`,
    );
    return () => f.rows(`drop trigger e6d_commit_block on public.${table}`);
  };

  return { ...d, diskKeys, reviewMedia, mediaCount, reviewRow, blockCommit };
}
