// К3-Е6д, Task 7 (Е6д-5, Е6д-6, аудит Codex р2 M5): межа serverFn подачі —
// справжній `FormData`, сесія з cookie (підмінено), відмови ДО першого запису.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { REVIEW_SUBMIT_ERROR } from 'simplycms/contracts';
import { MAX_REVIEW_IMAGE_BYTES } from 'simplycms/domain/media';
import { submitProductReview } from 'simplycms/core/lib/review-form';
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

describe('submitProductReview: FormData (Е6д-6)', () => {
  const d = useReviewPhotosDb('simplycms_e6d_rv_form');
  const { f } = d;
  const form = (files: File[], title = 'Заголовок') => {
    const fd = new FormData();
    fd.set('productId', f.ids.panel);
    fd.set('rating', '4');
    fd.set('title', title);
    fd.set('content', '<p>Текст</p>');
    for (const file of files) fd.append('images', file);
    return fd;
  };

  afterEach(() => vi.restoreAllMocks());

  it('успіх: rating рядком → 4, одне фото; порожній title → null', async () => {
    session.userId = await d.seedUser('Автор');
    const { id } = await submit({ data: form([pngFile(1)]) });
    const row = (await d.reviewRow(id))!;
    expect(row).toMatchObject({
      user_id: session.userId,
      rating: 4,
      title: 'Заголовок',
    });
    expect(row.images).toHaveLength(1);
    expect(await d.reviewMedia(id)).toHaveLength(1);

    session.userId = await d.seedUser('Без заголовка');
    const second = await submit({ data: form([], '') });
    expect(await d.reviewRow(second.id)).toMatchObject({
      title: null,
      images: [],
    });
  });

  const text = new File(['not an image, honestly'], 'a.png', {
    type: 'image/png',
  });
  const huge = new File(
    [new Uint8Array(MAX_REVIEW_IMAGE_BYTES + 1)],
    'big.png',
    { type: 'image/png' },
  );
  it.each([
    ['6 файлів', () => [1, 2, 3, 4, 5, 6].map(pngFile), 'tooManyImages'],
    ['текст з type image/png', () => [text], 'badImage'],
    ['валідний PNG, потім текст', () => [pngFile(1), text], 'badImage'],
    ['файл > 5 МБ', () => [huge], 'imageTooLarge'],
  ] as const)(
    '%s → код відмови, writeMedia не викликано',
    async (_, files, code) => {
      session.userId = await d.seedUser('Автор');
      const put = vi.spyOn(d.getMediaDriver(), 'put');
      const before = d.diskKeys();
      const mediaBefore = await d.mediaCount();
      await expect(submit({ data: form(files()) })).rejects.toThrow(
        REVIEW_SUBMIT_ERROR[code],
      );
      expect(put).not.toHaveBeenCalled();
      expect(d.diskKeys()).toEqual(before);
      expect(await d.mediaCount()).toBe(mediaBefore);
      expect(
        await d.count('product_reviews', 'user_id = $1', [session.userId]),
      ).toBe(0);
    },
  );

  it('рядок замість файлу в images → bad-format', async () => {
    session.userId = await d.seedUser('Автор');
    const fd = form([]);
    fd.append('images', 'ab/not-a-file.png');
    await expect(submit({ data: fd })).rejects.toThrow(
      REVIEW_SUBMIT_ERROR.badImage,
    );
  });
});
