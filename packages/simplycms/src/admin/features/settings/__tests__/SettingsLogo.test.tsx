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
import { makeWrapper, SETTINGS } from './render-support';

const { toastError, toastSuccess, invalidate } = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  invalidate: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: { error: toastError, success: toastSuccess },
}));
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate }),
}));
// Тости самого ImageUpload — окремий канал (use-toast), тут не цікавий.
vi.mock('simplycms/core/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const mocks = vi.hoisted(() => ({
  getSystemSettings: vi.fn(),
  saveStoreProfile: vi.fn(),
  saveStockManagement: vi.fn(),
  uploadMedia: vi.fn(),
  deleteMedia: vi.fn(),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock(mocks),
);

import SettingsPage from '../SettingsPage';

const t = createTranslator('uk');
let client: QueryClient;

const open = async () => {
  render(<SettingsPage />, { wrapper: makeWrapper(client) });
  await screen.findByLabelText(t('admin.settings.field.name'));
};
const removeLogoButton = () =>
  document.querySelector('.group .lucide-x')!.closest('button')!;

beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mocks.getSystemSettings.mockResolvedValue(SETTINGS);
  mocks.saveStoreProfile.mockImplementation(async ({ data }) => data);
  mocks.saveStockManagement.mockImplementation(async ({ data }) => data);
});
afterEach(() => cleanup());
describe('Логотип у формі налаштувань (Review Focus 2, клієнт)', () => {
  it('прибрати логотип у формі й не зберегти → deleteMedia НЕ викликано', async () => {
    await open();
    fireEvent.click(removeLogoButton());
    await waitFor(() =>
      expect(document.querySelector('.group .lucide-x')).toBeNull(),
    );
    expect(mocks.deleteMedia).not.toHaveBeenCalled();
    expect(mocks.saveStoreProfile).not.toHaveBeenCalled();
  });

  it('завантажити новий логотип і піти без збереження → лишається сирота (Е6б-14)', async () => {
    mocks.uploadMedia.mockResolvedValue({ ref: 'store_logo/new.png' });
    const view = render(<SettingsPage />, { wrapper: makeWrapper(client) });
    await screen.findByLabelText(t('admin.settings.field.name'));
    fireEvent.click(removeLogoButton());
    const input = document.querySelector('input[type="file"]')!;
    fireEvent.change(input, {
      target: {
        files: [new File(['x'], 'logo.png', { type: 'image/png' })],
      },
    });
    await waitFor(() => expect(mocks.uploadMedia).toHaveBeenCalled());
    view.unmount();
    // Новий рядок media лишився без посилання з профілю — чесна межа до sweep К4.
    expect(mocks.saveStoreProfile).not.toHaveBeenCalled();
    expect(mocks.deleteMedia).not.toHaveBeenCalled();
  });
});
