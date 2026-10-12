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
import {
  BANNERS,
  SECTIONS,
  SECTION_ID,
  stubDom,
  serverValidationError,
  type Call,
  pick,
  wrapper,
} from './render-support';

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
  updateBanners: vi.fn(),
  listSections: vi.fn(),
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
});
afterEach(() => cleanup());

describe('BannerEditPage: редагування', () => {
  it('прибрати картинку і «Скасувати»: жодного updateBanners', async () => {
    params.bannerId = BANNERS[0]!.id;
    render(<BannerEditPage />, { wrapper });
    await screen.findByDisplayValue('Літній розпродаж');
    fireEvent.click(
      within(screen.getAllByTestId('image-upload')[0]!).getByText(
        'clear-image',
      ),
    );
    fireEvent.click(screen.getByText(t('common.cancel')));
    expect(m.updateBanners).not.toHaveBeenCalled();
  });

  it('дата: у payload Date локального часу, незмінений dateFrom не йде', async () => {
    params.bannerId = BANNERS[0]!.id;
    m.updateBanners.mockImplementation(async () => [BANNERS[0]!]);
    render(<BannerEditPage />, { wrapper });
    await screen.findByDisplayValue('Літній розпродаж');
    expect(
      (screen.getByLabelText(t('admin.banners.timeFrom')) as HTMLInputElement)
        .value,
    ).toBe('09:00');
    fireEvent.change(screen.getByLabelText(t('common.dateTo')), {
      target: { value: '2026-10-10T09:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }));
    await waitFor(() => expect(m.updateBanners).toHaveBeenCalled());
    const [{ data }] = m.updateBanners.mock.calls[0] as [Call];
    expect(data[0]!.patch).toEqual({ dateTo: new Date(2026, 9, 10, 9, 0) });
  });

  it('section → home: у patch placement і sectionId: null', async () => {
    params.bannerId = BANNERS[1]!.id;
    m.updateBanners.mockImplementation(async () => [BANNERS[1]!]);
    render(<BannerEditPage />, { wrapper });
    await screen.findByDisplayValue('Банер ноутбуків');
    expect(
      screen.getByLabelText(t('admin.banners.placement.section')),
    ).toBeTruthy();
    await pick(
      t('admin.banners.placementLabel'),
      t('admin.banners.placement.home'),
    );
    expect(
      screen.queryByLabelText(t('admin.banners.placement.section')),
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }));
    await waitFor(() => expect(m.updateBanners).toHaveBeenCalled());
    const [{ data }] = m.updateBanners.mock.calls[0] as [Call];
    expect(data[0]!.patch).toEqual({ placement: 'home', sectionId: null });
  });

  it('home → section: обраний sectionId іде разом із placement', async () => {
    params.bannerId = BANNERS[0]!.id;
    m.updateBanners.mockImplementation(async () => [BANNERS[0]!]);
    render(<BannerEditPage />, { wrapper });
    await screen.findByDisplayValue('Літній розпродаж');
    await pick(
      t('admin.banners.placementLabel'),
      t('admin.banners.specificSection'),
    );
    await pick(t('admin.banners.placement.section'), 'Ноутбуки');
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }));
    await waitFor(() => expect(m.updateBanners).toHaveBeenCalled());
    const [{ data }] = m.updateBanners.mock.calls[0] as [Call];
    expect(data[0]!.patch).toEqual({
      placement: 'section',
      sectionId: SECTION_ID,
    });
  });

  it('ValidationError на sectionId: повідомлення під полем, тосту немає', async () => {
    params.bannerId = BANNERS[1]!.id;
    m.updateBanners.mockRejectedValue(
      serverValidationError([{ path: ['sectionId'], code: 'custom' }]),
    );
    render(<BannerEditPage />, { wrapper });
    await screen.findByDisplayValue('Банер ноутбуків');
    fireEvent.change(screen.getByLabelText(t('admin.banners.titleField')), {
      target: { value: 'Інша назва' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }));
    await screen.findByText(t('admin.validation.custom'));
    expect(toastError).not.toHaveBeenCalled();
  });
});
