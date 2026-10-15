// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { createTranslator } from 'simplycms/i18n';
import { BANNERS, stubDom, wrapper } from './render-support';

stubDom();

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }));

const m = vi.hoisted(() => ({
  listBanners: vi.fn(),
  updateBanners: vi.fn(),
  removeBanners: vi.fn(),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock(m),
);

import BannersPage from '../BannersPage';

const t = createTranslator('uk', 'uk');
const rowOf = (name: string) => screen.getByText(name).closest('tr')!;

beforeEach(() => {
  vi.clearAllMocks();
  m.listBanners.mockResolvedValue(BANNERS);
});
afterEach(() => cleanup());

describe('BannersPage', () => {
  it('рядок: розміщення, бейдж розкладу лише у банера з розкладом', async () => {
    render(<BannersPage />, { wrapper });
    await screen.findByText('Літній розпродаж');
    expect(
      within(rowOf('Банер ноутбуків')).getByText(
        t('admin.banners.placement.section'),
      ),
    ).toBeTruthy();
    expect(
      within(rowOf('Літній розпродаж')).getByText(t('admin.banners.scheduled')),
    ).toBeTruthy();
    expect(
      within(rowOf('Банер ноутбуків')).queryByText(
        t('admin.banners.scheduled'),
      ),
    ).toBeNull();
  });

  it('перемикач шле update { isActive: false }', async () => {
    m.updateBanners.mockImplementation(async () => [
      { ...BANNERS[0]!, isActive: false },
    ]);
    render(<BannersPage />, { wrapper });
    await screen.findByText('Літній розпродаж');
    fireEvent.click(within(rowOf('Літній розпродаж')).getByRole('switch'));
    await waitFor(() => expect(m.updateBanners).toHaveBeenCalled());
    const [{ data }] = m.updateBanners.mock.calls[0] as [
      { data: Array<{ id: string; patch: unknown }> },
    ];
    expect(data[0]).toEqual({
      id: BANNERS[0]!.id,
      patch: { isActive: false },
    });
  });

  it('видалення: delete лише після підтвердження в діалозі', async () => {
    m.removeBanners.mockResolvedValue([BANNERS[0]!.id]);
    render(<BannersPage />, { wrapper });
    await screen.findByText('Літній розпродаж');
    fireEvent.click(
      within(rowOf('Літній розпродаж')).getByRole('button', {
        name: t('common.delete'),
      }),
    );
    const dialog = await screen.findByRole('alertdialog');
    expect(m.removeBanners).not.toHaveBeenCalled();
    fireEvent.click(
      within(dialog).getByRole('button', { name: t('common.delete') }),
    );
    await waitFor(() => expect(m.removeBanners).toHaveBeenCalled());
  });

  it('скасування діалогу не видаляє', async () => {
    render(<BannersPage />, { wrapper });
    await screen.findByText('Літній розпродаж');
    fireEvent.click(
      within(rowOf('Літній розпродаж')).getByRole('button', {
        name: t('common.delete'),
      }),
    );
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(
      within(dialog).getByRole('button', { name: t('common.cancel') }),
    );
    expect(m.removeBanners).not.toHaveBeenCalled();
  });
});
