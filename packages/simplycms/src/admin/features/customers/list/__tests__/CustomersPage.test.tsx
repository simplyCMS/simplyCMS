// @vitest-environment jsdom
/** Список покупців (Task 9, Е6г): рядки, бейджі, «Показати ще», порожній стан. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, screen, waitFor } from '@testing-library/react';
import { createTranslator } from 'simplycms/i18n';
import { formatPrice } from 'simplycms/domain/money';
import { ENGINE } from '../../../products/edit/__tests__/test-engine-stub';
import { mocks, page, renderPage, row, stubDom } from './render-support';

vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock((await import('./mocks')).mocks),
);
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    params,
    children,
  }: {
    to: string;
    params: { userId: string };
    children: React.ReactNode;
  }) => <a href={to.replace('$userId', params.userId)}>{children}</a>,
}));

const t = createTranslator('uk');

beforeEach(() => {
  stubDom();
  mocks.listCustomers.mockReset();
});
afterEach(cleanup);

describe('CustomersPage', () => {
  it('рядок: імʼя, email, категорія, замовлення, сума, посилання на картку', async () => {
    mocks.listCustomers.mockResolvedValue(page([row(2)]));
    renderPage();
    const link = await screen.findByRole('link', { name: /Покупець 2/ });
    expect(link.getAttribute('href')).toBe(
      '/admin/users/u0000000-0000-4000-8000-000000000002',
    );
    expect(screen.getByText('buyer2@shop.test')).toBeTruthy();
    expect(screen.getByText('Опт')).toBeTruthy();
    expect(
      screen.getByText(formatPrice(200, ENGINE.config).replace(/\s/g, ' ')),
    ).toBeTruthy();
  });

  it('без імені → email; бейджі «Адмін» і «Заблоковано» лише де треба', async () => {
    mocks.listCustomers.mockResolvedValue(
      page([
        row(1, { name: null, isAdmin: true }),
        row(2, { bannedAt: new Date() }),
        row(3),
      ]),
    );
    renderPage();
    await screen.findByRole('link', { name: 'buyer1@shop.test' });
    expect(screen.getAllByText(t('admin.users.adminBadge'))).toHaveLength(1);
    expect(screen.getAllByText(t('admin.users.banned'))).toHaveLength(1);
  });

  it('порожній стан', async () => {
    mocks.listCustomers.mockResolvedValue(page([]));
    renderPage();
    await screen.findByText(t('admin.users.empty'));
  });

  it('«Показати ще» кличе listCustomers з cursor попередньої сторінки (Date)', async () => {
    const cursor = { createdAt: new Date('2026-10-01T09:59:58.123Z'), id: 'x' };
    mocks.listCustomers
      .mockResolvedValueOnce(page([row(1), row(2)], cursor))
      .mockResolvedValueOnce(page([row(3)]));
    renderPage();
    const more = await screen.findByRole('button', {
      name: t('admin.users.loadMore'),
    });
    await act(async () => more.click());
    await screen.findByText('buyer3@shop.test');
    const second = mocks.listCustomers.mock.calls[1]![0].data;
    expect(second.cursor).toEqual(cursor);
    expect(second.cursor.createdAt).toBeInstanceOf(Date);
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: t('admin.users.loadMore') }),
      ).toBeNull(),
    );
  });
});
