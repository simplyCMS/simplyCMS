// К3-Е6д-4/5, Е6д-21: реальний `lookupMediaForRequest` проти живої БД.
// Сесії фейкові (`x-test-user` → субʼєкт), усе решта — справжнє: гість іде
// через `withStorefrontDb` (app_user), покупець — через `withCustomerDb`.
import { describe, expect, it, vi } from 'vitest';
import {
  deleteProductReview,
  withCustomerDb,
} from 'simplycms/storefront/loaders';
import { lookupMediaForRequest } from 'simplycms/storefront/media-visibility';
import { useReviewsDb } from './fixtures/reviews';

const sessions = vi.hoisted(
  () => new Map<string, { userId: string; roles: string[] }>(),
);
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig<typeof import('simplycms/auth')>()),
  readSessionSubject: vi.fn(async (headers: Headers) => {
    const s = sessions.get(headers.get('x-test-user') ?? '');
    return s ? { ...s, email: 'x@example.test', name: null } : null;
  }),
}));

describe('роздача медіа: рядок і видимість (Е6д-21)', () => {
  const d = useReviewsDb('simplycms_e6d_media_visibility');
  const { f } = d;

  const as = (userId?: string) =>
    new Request('http://localhost/media/x', {
      headers: userId ? { 'x-test-user': userId } : {},
    });
  const user = async (roles: string[] = ['user']) => {
    const id = await d.seedUser('Глядач');
    sessions.set(id, { userId: id, roles });
    return id;
  };
  const photoOf = async (status: string, author: string) => {
    const review = await d.seedReview({ status, userId: author });
    const [ref] = await d.seedPhotos(review, 1);
    return { review, ref: ref! };
  };

  it('pending: гість hidden, автор видно, інший покупець hidden, адмін видно', async () => {
    const author = await user();
    const other = await user();
    const admin = await user(['admin']);
    const { ref } = await photoOf('pending', author);
    expect(await lookupMediaForRequest(ref, as())).toBe('hidden');
    expect(await lookupMediaForRequest(ref, as(author))).toEqual({
      personal: true,
    });
    expect(await lookupMediaForRequest(ref, as(other))).toBe('hidden');
    expect(await lookupMediaForRequest(ref, as(admin))).toEqual({
      personal: true,
    });
  });

  it('approved: гість бачить', async () => {
    const author = await user();
    const { ref } = await photoOf('approved', author);
    expect(await lookupMediaForRequest(ref, as())).toEqual({ personal: true });
  });

  it('відгук, видалений покупцем через публічний шлях → missing', async () => {
    const author = await user();
    const { review, ref } = await photoOf('approved', author);
    const res = await withCustomerDb(author, (db, op) =>
      deleteProductReview(db, op, author, review),
    );
    expect(res.deleted).toBe(true);
    expect(await lookupMediaForRequest(ref, as())).toBe('missing');
  });

  it('аватар → personal: true; банер → personal: false; невідомий ключ → missing', async () => {
    const owner = await user();
    const banner = crypto.randomUUID();
    const insertMedia = (type: string, id: string, key: string) =>
      f.rows(
        `insert into public.media (id, entity_type, entity_id, storage_key, size_bytes, mime_type)
         values (gen_random_uuid(), $1, $2, $3, 1, 'image/png')`,
        [type, id, key],
      );
    await insertMedia('avatar', owner, 'ab/avatar.png');
    await insertMedia('banner', banner, 'ab/banner.png');
    expect(await lookupMediaForRequest('ab/avatar.png', as())).toEqual({
      personal: true,
    });
    expect(await lookupMediaForRequest('ab/banner.png', as())).toEqual({
      personal: false,
    });
    expect(await lookupMediaForRequest('ab/none.png', as())).toBe('missing');
  });

  it('MEDIA_VISIBILITY має резолвер review', async () => {
    const { MEDIA_VISIBILITY } =
      await import('simplycms/storefront/media-visibility');
    expect(MEDIA_VISIBILITY.review).toBeTypeOf('function');
  });
});
