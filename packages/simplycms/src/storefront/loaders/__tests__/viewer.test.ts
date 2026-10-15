import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Р29: глядач публічного лоадера з цінами — лише з серверної сесії, а
 * персоналізована відповідь залогіненому — `private, no-store`, щоб спільний
 * кеш перед магазином не віддав гуртовий прайс наступному відвідувачу.
 * Сам фільтр видів на живому Postgres доводить харнес
 * (`storefront-price-visibility.test.ts`).
 */
const server = vi.hoisted(() => ({
  setResponseHeader: vi.fn(),
  subject: null as { userId: string } | null,
}));
const db = vi.hoisted(() => ({
  withStorefrontDb: vi.fn(async (fn: (db: unknown) => unknown) =>
    fn('guest-tx'),
  ),
  withCustomerDb: vi.fn(async (_userId: string, fn: (db: unknown) => unknown) =>
    fn('customer-tx'),
  ),
}));
const commerce = vi.hoisted(() => ({
  loadViewerPriceTypes: vi.fn(async () => ({ ids: ['retail'] })),
}));

vi.mock('@tanstack/react-start/server', () => ({
  getRequest: () => ({ headers: new Headers() }),
  setResponseHeader: (...args: unknown[]) => server.setResponseHeader(...args),
}));
vi.mock('simplycms/auth', () => ({
  readSessionSubject: async () => server.subject,
}));
vi.mock('../db', () => db);
vi.mock('simplycms/commerce', () => commerce);

import { withViewerDb } from '../viewer';

beforeEach(() => {
  server.setResponseHeader.mockClear();
  db.withStorefrontDb.mockClear();
  db.withCustomerDb.mockClear();
  commerce.loadViewerPriceTypes.mockClear();
});

describe('withViewerDb (Р29)', () => {
  it('гість: публічна транзакція, види гостя, без private', async () => {
    server.subject = null;
    const seen = await withViewerDb(async (tx, viewer) => ({ tx, viewer }));
    expect(seen).toEqual({ tx: 'guest-tx', viewer: { ids: ['retail'] } });
    expect(commerce.loadViewerPriceTypes).toHaveBeenCalledWith(
      'guest-tx',
      null,
    );
    expect(db.withCustomerDb).not.toHaveBeenCalled();
    expect(server.setResponseHeader).not.toHaveBeenCalled();
  });

  it('залогінений: актор і види — з сесії, відповідь private, no-store', async () => {
    server.subject = { userId: 'u-wholesale' };
    const seen = await withViewerDb(async (tx) => tx);
    expect(seen).toBe('customer-tx');
    expect(db.withCustomerDb.mock.calls[0]?.[0]).toBe('u-wholesale');
    expect(commerce.loadViewerPriceTypes).toHaveBeenCalledWith(
      'customer-tx',
      'u-wholesale',
    );
    expect(server.setResponseHeader).toHaveBeenCalledWith(
      'cache-control',
      'private, no-store',
    );
  });
});
