// Е6д-17: відповідь `getProductReviews` залежить від сесії (автор бачить свій
// `pending`), тож вона не має осідати в спільному кеші.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const setResponseHeader = vi.fn();

// Білдер підмінено тотожністю над хендлером: перевіряємо тіло serverFn, а не
// RPC-транспорт Start (він вимагає AsyncLocalStorage-контексту сервера).
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    const builder = {
      validator: () => builder,
      handler: (fn: unknown) => fn,
    };
    return builder;
  },
}));
vi.mock('@tanstack/react-start/server', () => ({
  getRequest: () => ({ headers: new Headers() }),
  setResponseHeader: (...args: unknown[]) => setResponseHeader(...args),
}));
vi.mock('simplycms/auth', () => ({ readSessionSubject: async () => null }));
vi.mock('simplycms/storefront/loaders', () => ({
  loadProductRatings: vi.fn(),
  loadProductReviews: async () => [],
  loadReviewAuthors: vi.fn(),
  withCustomerDb: vi.fn(),
  withStorefrontDb: async (fn: (db: unknown) => unknown) => fn({}),
  withStoreOperatorDb: vi.fn(),
}));

import { getProductReviews } from '../reviews';

describe('getProductReviews', () => {
  beforeEach(() => setResponseHeader.mockClear());

  it('виставляє cache-control: private, no-store', async () => {
    await (getProductReviews as unknown as (arg: unknown) => Promise<unknown>)({
      data: { productId: '44444444-4444-4444-8444-444444444444' },
    });
    expect(setResponseHeader).toHaveBeenCalledWith(
      'cache-control',
      'private, no-store',
    );
  });
});
