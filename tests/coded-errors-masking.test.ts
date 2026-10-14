import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REVIEW_SUBMIT_ERROR } from 'simplycms/contracts';
import { CodedError } from 'simplycms/contracts/domain-errors';
import { MAX_REVIEW_IMAGES } from 'simplycms/domain/media';
import { parseUploadForm } from 'simplycms/admin-server/impl';
import { maskUnexpectedError } from 'simplycms/server-guard';
import { updateProductReviewWithImages } from '../packages/simplycms/src/storefront/loaders/reviews-edit';

const PROD = { NODE_ENV: 'production' } as const;
const mask = (error: unknown) =>
  maskUnexpectedError(error, {
    env: PROD,
    log: () => {},
    newId: () => 'ab12cd34',
  });

/** Кидає те, що кидає справжній код, і повертає помилку як є. */
async function thrown(run: () => unknown): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error;
  }
  throw new Error('очікувалась відмова');
}

describe('машинні коди serverFn переживають маскування Р23', () => {
  it('media/*: код форми завантаження доходить до клієнта незмінним', async () => {
    const noFile = await thrown(() => parseUploadForm(new FormData()));
    const badType = await thrown(() => {
      const form = new FormData();
      form.set('file', new File(['x'], 'a.png'));
      form.set('entityType', 'nope');
      return parseUploadForm(form);
    });
    for (const [error, code] of [
      [noFile, 'media/no-file'],
      [badType, 'media/bad-entity-type'],
    ] as const) {
      const out = mask(error);
      expect(out).toBe(error);
      expect((out as Error).message).toBe(code);
    }
  });

  it('review/*: відмова правки відгуку доходить незміненою', async () => {
    const error = await thrown(() =>
      updateProductReviewWithImages('u', {
        id: 'r',
        keep: Array.from({ length: MAX_REVIEW_IMAGES + 1 }, (_, i) => `k${i}`),
        files: [],
      } as never),
    );
    expect(mask(error)).toBe(error);
    expect((error as Error).message).toBe(REVIEW_SUBMIT_ERROR.tooManyImages);
  });

  it('CodedError: ім’я з закритої родини, повідомлення — сам код', () => {
    const error = new CodedError('avatar/bad-format');
    expect(mask(error)).toBe(error);
    expect(error.message).toBe('avatar/bad-format');
  });

  it('звичайний Error з тим самим текстом маскується', () => {
    const out = mask(new Error('media/bad-format')) as Error;
    expect(out.message).toBe('Internal server error [ref ab12cd34]');
  });

  // serverFn аватара й подачі відгуку без сесії й БД не запустити, тож
  // решту місць стереже сканування: машинний код — лише через CodedError.
  it.each([
    'core/lib/profile-avatar.ts',
    'core/lib/review-form.ts',
    'storefront/loaders/reviews-write.ts',
    'storefront/loaders/reviews-edit.ts',
    'admin-server/impl/media/operations.ts',
  ])('%s: жодного new Error(<код>)', (file) => {
    const source = readFileSync(
      resolve(__dirname, '../packages/simplycms/src', file),
      'utf8',
    );
    expect(source).not.toMatch(
      /new Error\(\s*(REVIEW_SUBMIT_ERROR|REASON_CODE|AVATAR_|'(media|avatar|review)\/)/,
    );
  });
});
