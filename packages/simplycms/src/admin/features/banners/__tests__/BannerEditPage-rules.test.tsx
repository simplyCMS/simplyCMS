// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { createTranslator } from 'simplycms/i18n';
import {
  BANNERS,
  SECTIONS,
  stubDom,
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
  insertBanners: vi.fn(),
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

const save = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }));
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('BannerEditPage: тиха відмова submit', () => {
  const cases: Array<[string, string, string, string]> = [
    [
      'title >200',
      t('admin.banners.titleField'),
      'x'.repeat(201),
      'admin.banners.titleTooLong',
    ],
    [
      'title порожній',
      t('admin.banners.titleField'),
      '  ',
      'admin.banners.titleRequired',
    ],
    [
      'subtitle >500',
      t('admin.banners.subtitle'),
      'x'.repeat(501),
      'admin.banners.subtitleTooLong',
    ],
    [
      'overlay небезпечний',
      t('admin.banners.overlayColor'),
      'red; background:url(x)',
      'admin.banners.overlayInvalid',
    ],
    [
      'sortOrder від’ємний',
      t('common.sortOrder'),
      '-1',
      'admin.banners.sortInvalid',
    ],
  ];
  it.each(cases)(
    '%s: повідомлення видно, сервер не кличеться',
    async (_n, label, value, key) => {
      params.bannerId = BANNERS[0]!.id;
      render(<BannerEditPage />, { wrapper });
      await screen.findByDisplayValue('Літній розпродаж');
      type(label, value);
      save();
      await screen.findByText(t(key as never));
      expect(m.updateBanners).not.toHaveBeenCalled();
      expect(m.insertBanners).not.toHaveBeenCalled();
    },
  );
});

describe('BannerEditPage: sectionId у patch при зміні placement', () => {
  it('home → catalog: sectionId лишається null (колекція відкидає рівні значення), patch { placement }', async () => {
    params.bannerId = BANNERS[0]!.id;
    m.updateBanners.mockImplementation(async () => [BANNERS[0]!]);
    render(<BannerEditPage />, { wrapper });
    await screen.findByDisplayValue('Літній розпродаж');
    await pick(
      t('admin.banners.placementLabel'),
      t('admin.banners.placement.catalog'),
    );
    save();
    await waitFor(() => expect(m.updateBanners).toHaveBeenCalled());
    const [{ data }] = m.updateBanners.mock.calls[0] as [Call];
    expect(data[0]!.patch).toEqual({ placement: 'catalog' });
  });
});
