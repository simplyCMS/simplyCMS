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
import { BANNERS, SECTIONS, stubDom, wrapper } from './render-support';

stubDom();

const { toastError, navigate, params } = vi.hoisted(() => ({
  toastError: vi.fn(),
  navigate: vi.fn(),
  params: { bannerId: 'new' },
}));
vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn() } }));
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
  useParams: () => params,
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock('../../../components/ImageUpload', () => import('./image-upload-stub'));

const m = vi.hoisted(() => ({
  listBanners: vi.fn(),
  insertBanners: vi.fn(),
  updateBanners: vi.fn(),
  removeBanners: vi.fn(),
  listSections: vi.fn(),
  deleteMedia: vi.fn(),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock(m),
);

import BannerEditPage from '../BannerEditPage';

const t = createTranslator('uk');

beforeEach(() => {
  vi.clearAllMocks();
  params.bannerId = 'new';
  m.listBanners.mockResolvedValue(BANNERS);
  m.listSections.mockResolvedValue(SECTIONS);
  m.insertBanners.mockImplementation(async ({ data }) => data);
});
afterEach(() => cleanup());

describe('BannerEditPage: створення', () => {
  it('усі три ImageUpload: один entityId, eraseOnRemove=false; id йде в insert', async () => {
    render(<BannerEditPage />, { wrapper });
    const ups = screen.getAllByTestId('image-upload');
    expect(ups).toHaveLength(3);
    const id = ups[0]!.getAttribute('data-entity-id');
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    for (const up of ups) {
      expect(up.getAttribute('data-entity-type')).toBe('banner');
      expect(up.getAttribute('data-entity-id')).toBe(id);
      expect(up.getAttribute('data-erase')).toBe('false');
    }
    fireEvent.change(screen.getByLabelText(t('admin.banners.titleField')), {
      target: { value: 'Новий' },
    });
    fireEvent.click(within(ups[0]!).getByText('add-image'));
    fireEvent.click(screen.getByRole('button', { name: 'Створити' }));
    await waitFor(() => expect(m.insertBanners).toHaveBeenCalled());
    const [{ data }] = m.insertBanners.mock.calls[0] as [
      { data: Array<Record<string, unknown>> },
    ];
    expect(data[0]).toMatchObject({
      id,
      title: 'Новий',
      imageUrl: 'banner/n/new.jpg',
      placement: 'home',
      sectionId: null,
      scheduleDays: null,
    });
  });

  it('четверта кнопка недоступна', async () => {
    render(<BannerEditPage />, { wrapper });
    const add = screen.getByRole('button', { name: t('common.add') });
    for (let i = 0; i < 3; i++) fireEvent.click(add);
    expect(
      screen.getAllByText(new RegExp(`^${t('admin.banners.button')} \\d$`)),
    ).toHaveLength(3);
    expect((add as HTMLButtonElement).disabled).toBe(true);
  });

  it('кнопка з javascript: у url не зберігається', async () => {
    render(<BannerEditPage />, { wrapper });
    fireEvent.change(screen.getByLabelText(t('admin.banners.titleField')), {
      target: { value: 'X' },
    });
    fireEvent.click(
      within(screen.getAllByTestId('image-upload')[0]!).getByText('add-image'),
    );
    fireEvent.click(screen.getByRole('button', { name: t('common.add') }));
    fireEvent.change(screen.getByLabelText(t('common.text')), {
      target: { value: 'Go' },
    });
    fireEvent.change(screen.getByLabelText('URL'), {
      target: { value: 'javascript:alert(1)' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Створити' }));
    await screen.findByText(t('admin.banners.buttonInvalid'));
    expect(m.insertBanners).not.toHaveBeenCalled();
  });
});
