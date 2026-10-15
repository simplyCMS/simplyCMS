// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { createTranslator } from 'simplycms/i18n';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';
import { makeWrapper } from './render-support';

const { toastError, toastSuccess } = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: { error: toastError, success: toastSuccess },
}));

const mocks = vi.hoisted(() => ({
  listMailOutbox: vi.fn(),
  retryMailOutbox: vi.fn(),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock(mocks),
);

import { MailOutboxCard } from '../MailOutboxCard';

const t = createTranslator('uk', 'uk');
const KEY = entityKey(ENTITY.mailOutbox).all();
const SECRET = 'https://shop.test/reset?token=TOP-SECRET-TOKEN';
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);
const TAIL = {
  id: 'a1',
  kind: 'password_reset',
  requestedAt: hoursAgo(3),
  attempts: 2,
  lastError: 'SMTP: ECONNREFUSED',
};
let client: QueryClient;

beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(cleanup);

describe('MailOutboxCard (Е8-Р10)', () => {
  it('показує вид, вік і помилку хвоста; тіла листа немає', async () => {
    // Навіть якщо сервер помилково віддасть `message`, картка його не рендерить.
    mocks.listMailOutbox.mockResolvedValue([
      { ...TAIL, message: { text: SECRET } },
    ]);
    const { container } = render(<MailOutboxCard />, {
      wrapper: makeWrapper(client),
    });
    expect(
      await screen.findByText(t('admin.settings.mail.kind.password_reset')),
    ).toBeTruthy();
    expect(
      screen.getByText(
        (text) => text.includes('3 год') && text.includes('Спроб: 2'),
      ),
    ).toBeTruthy();
    expect(screen.getByText(/ECONNREFUSED/)).toBeTruthy();
    expect(container.textContent).not.toContain('TOP-SECRET-TOKEN');
  });

  it('порожній стан → «усе надіслано», кнопка вимкнена', async () => {
    mocks.listMailOutbox.mockResolvedValue([]);
    render(<MailOutboxCard />, { wrapper: makeWrapper(client) });
    expect(
      await screen.findByText(t('admin.settings.mail.empty')),
    ).toBeTruthy();
    const btn = screen.getByRole('button', {
      name: t('admin.settings.mail.retry'),
    }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('«Повторити» кличе мутацію й інвалідує ключ mail_outbox', async () => {
    mocks.listMailOutbox.mockResolvedValueOnce([TAIL]).mockResolvedValue([]);
    mocks.retryMailOutbox.mockResolvedValue({ sent: 1, failed: 0 });
    const spy = vi.spyOn(client, 'invalidateQueries');
    render(<MailOutboxCard />, { wrapper: makeWrapper(client) });
    await screen.findByText(t('admin.settings.mail.kind.password_reset'));
    fireEvent.click(
      screen.getByRole('button', { name: t('admin.settings.mail.retry') }),
    );
    await waitFor(() => expect(mocks.retryMailOutbox).toHaveBeenCalled());
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: KEY }));
    expect(
      await screen.findByText(t('admin.settings.mail.empty')),
    ).toBeTruthy();
    expect(toastSuccess).toHaveBeenCalledWith(
      t('admin.settings.mail.retried', { sent: 1, failed: 0 }),
    );
  });
});
