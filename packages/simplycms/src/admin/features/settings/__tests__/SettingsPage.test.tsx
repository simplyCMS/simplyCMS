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
import {
  ADMIN_STATE_CONSTRAINT,
  DOMAIN_ERROR_NAME,
} from 'simplycms/contracts/domain-errors';
import { makeWrapper, PROFILE, SETTINGS } from './render-support';

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
const KEY = entityKey(ENTITY.systemSettings).all();
let client: QueryClient;

const open = async () => {
  render(<SettingsPage />, { wrapper: makeWrapper(client) });
  await screen.findByLabelText(t('admin.settings.field.name'));
};
const save = () =>
  fireEvent.click(screen.getByRole('button', { name: t('common.save') }));

beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mocks.getSystemSettings.mockResolvedValue(SETTINGS);
  mocks.saveStoreProfile.mockImplementation(async ({ data }) => data);
  mocks.saveStockManagement.mockImplementation(async ({ data }) => data);
});
afterEach(() => cleanup());

describe('SettingsPage', () => {
  it('форма відкривається з даними getSystemSettings', async () => {
    await open();
    expect(screen.getByLabelText(t('admin.settings.field.name'))).toBeTruthy();
    expect(screen.getByDisplayValue(PROFILE.name)).toBeTruthy();
    expect(screen.getByDisplayValue('+380501112233')).toBeTruthy();
    expect(screen.getByDisplayValue('https://instagram.com/shop')).toBeTruthy();
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe(
      'false',
    );
  });

  it('збереження шле logo = референс, порожні поля → null, і скидає кеш роутера', async () => {
    await open();
    fireEvent.change(screen.getByLabelText(t('admin.settings.field.name')), {
      target: { value: 'Нова назва' },
    });
    save();
    await waitFor(() => expect(mocks.saveStoreProfile).toHaveBeenCalled());
    expect(mocks.saveStoreProfile).toHaveBeenCalledWith({
      data: { ...PROFILE, name: 'Нова назва' },
    });
    await waitFor(() => expect(invalidate).toHaveBeenCalled());
    expect(toastSuccess).toHaveBeenCalled();
  });

  it('409 store_logo_invalid → тост із ключем, router не скидається', async () => {
    mocks.saveStoreProfile.mockRejectedValue({
      name: DOMAIN_ERROR_NAME.adminConflict,
      kind: 'state',
      constraint: ADMIN_STATE_CONSTRAINT.storeLogoInvalid,
    });
    await open();
    save();
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        t('admin.errors.storeLogoInvalid'),
      ),
    );
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('посилання http:// → помилка поля, запиту немає', async () => {
    await open();
    fireEvent.change(screen.getByDisplayValue('https://instagram.com/shop'), {
      target: { value: 'http://instagram.com/shop' },
    });
    save();
    expect(
      await screen.findByText(t('admin.settings.socials.urlInvalid')),
    ).toBeTruthy();
    expect(mocks.saveStoreProfile).not.toHaveBeenCalled();
  });

  it('соцмережі: «Додати» вимикається на 10-му рядку', async () => {
    await open();
    const add = screen.getByRole('button', {
      name: t('admin.settings.socials.add'),
    });
    for (let i = 0; i < 9; i++) fireEvent.click(add);
    await waitFor(() => expect((add as HTMLButtonElement).disabled).toBe(true));
    expect(screen.getAllByRole('combobox')).toHaveLength(10);
  });

  it('перемикач складу шле saveStockManagement одразу й пише відповідь у кеш без refetch', async () => {
    mocks.saveStockManagement.mockResolvedValue({ decreaseOnOrder: true });
    await open();
    fireEvent.click(screen.getByRole('switch'));
    await waitFor(() =>
      expect(mocks.saveStockManagement).toHaveBeenCalledWith({
        data: { decreaseOnOrder: true },
      }),
    );
    await waitFor(() =>
      expect(
        client.getQueryData<typeof SETTINGS>(KEY)?.stockManagement,
      ).toEqual({ decreaseOnOrder: true }),
    );
    expect(client.getQueryState(KEY)?.isInvalidated).toBe(false);
    expect(mocks.getSystemSettings).toHaveBeenCalledTimes(1);
    expect(mocks.saveStoreProfile).not.toHaveBeenCalled();
  });
});
