// К3-Е6д, Task 9 (Е6д-23): межа serverFn правки — справжній `FormData`
// (`id`, `keep`, `images`), сесія з cookie, відмови ДО першого запису.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { REVIEW_SUBMIT_ERROR } from 'simplycms/contracts';
import {
  submitProductReview,
  updateProductReview,
} from 'simplycms/core/lib/review-form';
import { pngFile, useReviewPhotosDb } from './fixtures/review-photos';

const session = vi.hoisted(() => ({ userId: '' }));

// Білдер — тотожність над валідатором і хендлером: перевіряємо тіло serverFn,
// а не RPC-транспорт Start (він вимагає контексту сервера).
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    let validate = (data: unknown): unknown => data;
    const builder = {
      validator: (v: unknown) => {
        validate =
          typeof v === 'function'
            ? (v as (d: unknown) => unknown)
            : (d) => (v as { parse: (d: unknown) => unknown }).parse(d);
        return builder;
      },
      handler:
        (fn: (a: { data: unknown }) => unknown) =>
        async (arg: { data: unknown }) =>
          fn({ data: validate(arg.data) }),
    };
    return builder;
  },
}));
vi.mock('@tanstack/react-start/server', () => ({
  getRequest: () => ({ headers: new Headers() }),
  setResponseStatus: vi.fn(),
}));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  readSessionSubject: async () => ({ userId: session.userId }),
}));

const submit = submitProductReview as unknown as (a: {
  data: FormData;
}) => Promise<{ id: string }>;
const update = updateProductReview as unknown as typeof submit;

describe('updateProductReview: FormData (Е6д-23)', () => {
  const d = useReviewPhotosDb('simplycms_e6d_rv_editform');
  const { f } = d;
  const seeded = async () => {
    session.userId = await d.seedUser('Автор');
    const fd = new FormData();
    fd.set('productId', f.ids.panel);
    fd.set('rating', '5');
    fd.set('title', 'Старий');
    fd.set('content', '');
    fd.append('images', pngFile(1));
    const { id } = await submit({ data: fd });
    return { id, refs: (await d.reviewRow(id))!.images! };
  };
  const form = (id: string, keep: string[], files: File[] = []) => {
    const fd = new FormData();
    fd.set('id', id);
    fd.set('rating', '2');
    fd.set('title', '');
    fd.set('content', '<p>Нове</p>');
    for (const k of keep) fd.append('keep', k);
    for (const file of files) fd.append('images', file);
    return fd;
  };

  afterEach(() => vi.restoreAllMocks());

  it('успіх: keep + нове фото, порожній title → null, pending', async () => {
    const { id, refs } = await seeded();
    await update({ data: form(id, refs, [pngFile(2)]) });
    const row = (await d.reviewRow(id))!;
    expect(row).toMatchObject({ status: 'pending', rating: 2, title: null });
    expect(row.images).toHaveLength(2);
    expect(row.images![0]).toBe(refs[0]);
  });

  it('🔴 keep + files > 5 → відмова ДО запису, нічого не змінено', async () => {
    const { id, refs } = await seeded();
    const put = vi.spyOn(d.getMediaDriver(), 'put');
    await expect(
      update({ data: form(id, refs, [2, 3, 4, 5, 6].map(pngFile)) }),
    ).rejects.toThrow(REVIEW_SUBMIT_ERROR.tooManyImages);
    expect(put).not.toHaveBeenCalled();
    expect(await d.reviewRow(id)).toMatchObject({ title: 'Старий', rating: 5 });
  });

  it('id не uuid → відмова валідації, відгук цілий', async () => {
    const { id } = await seeded();
    await expect(update({ data: form('x', []) })).rejects.toThrow();
    expect((await d.reviewRow(id))!.title).toBe('Старий');
  });
});
