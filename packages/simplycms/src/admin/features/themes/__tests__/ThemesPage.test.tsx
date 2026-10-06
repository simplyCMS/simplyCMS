// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { createTranslator } from 'simplycms/i18n';
import {
  ADMIN_STATE_CONSTRAINT,
  DOMAIN_ERROR_NAME,
} from 'simplycms/contracts/domain-errors';
import { makeWrapper } from '../../settings/__tests__/render-support';
import { themeRow } from './theme-rows';

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
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));
// `ghost` — рядок у БД без модуля у збірці (пакет теми видалено).
vi.mock('simplycms/themes/ThemeRegistry', () => ({
  ThemeRegistry: { has: (name: string) => name !== 'ghost' },
}));

const mocks = vi.hoisted(() => ({
  listThemes: vi.fn(),
  activateTheme: vi.fn(),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock(mocks),
);

import ThemesPage from '../ThemesPage';

const t = createTranslator('uk');
let client: QueryClient;

const card = (displayName: string) =>
  screen.getByRole('group', { name: displayName });
const activateIn = (displayName: string) =>
  within(card(displayName)).getByRole('button', {
    name: t('common.activate'),
  }) as HTMLButtonElement;

async function activate(displayName: string) {
  fireEvent.click(activateIn(displayName));
  const dialog = await screen.findByRole('alertdialog');
  fireEvent.click(
    within(dialog).getByRole('button', { name: t('common.activate') }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  invalidate.mockResolvedValue(undefined);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => cleanup());

describe('ThemesPage', () => {
  it('тема без модуля у збірці: «Активувати» вимкнена, підказка видима', async () => {
    mocks.listThemes.mockResolvedValue([
      themeRow('default', true),
      themeRow('ghost', false),
    ]);
    render(<ThemesPage />, { wrapper: makeWrapper(client) });
    await screen.findByRole('group', { name: 'GHOST' });

    expect(activateIn('GHOST').disabled).toBe(true);
    expect(
      within(card('GHOST')).getByText(t('admin.themes.moduleMissingHint')),
    ).toBeTruthy();
  });

  it('активація: write-back переносить бейдж в обох рядках без refetch і скидає кеш роутера', async () => {
    mocks.listThemes.mockResolvedValue([
      themeRow('default', true),
      themeRow('solarstore', false),
    ]);
    mocks.activateTheme.mockResolvedValue([
      themeRow('default', false),
      themeRow('solarstore', true),
    ]);
    render(<ThemesPage />, { wrapper: makeWrapper(client) });
    await screen.findByRole('group', { name: 'SOLARSTORE' });
    expect(
      within(card('DEFAULT')).queryByText(t('common.activeF')),
    ).toBeTruthy();

    await activate('SOLARSTORE');

    await waitFor(() =>
      expect(
        within(card('SOLARSTORE')).queryByText(t('common.activeF')),
      ).toBeTruthy(),
    );
    expect(within(card('DEFAULT')).queryByText(t('common.activeF'))).toBeNull();
    expect(mocks.activateTheme).toHaveBeenCalledWith({
      data: { name: 'solarstore' },
    });
    expect(mocks.listThemes).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(1));
    expect(toastSuccess).toHaveBeenCalled();
  });

  it('409 theme_not_built → тост із ключем, кеш роутера не скидається', async () => {
    mocks.listThemes.mockResolvedValue([
      themeRow('default', true),
      themeRow('solarstore', false),
    ]);
    mocks.activateTheme.mockRejectedValue({
      name: DOMAIN_ERROR_NAME.adminConflict,
      kind: 'state',
      constraint: ADMIN_STATE_CONSTRAINT.themeNotBuilt,
    });
    render(<ThemesPage />, { wrapper: makeWrapper(client) });
    await screen.findByRole('group', { name: 'SOLARSTORE' });

    await activate('SOLARSTORE');

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(t('admin.errors.themeNotBuilt')),
    );
    expect(invalidate).not.toHaveBeenCalled();
    expect(
      within(card('DEFAULT')).queryByText(t('common.activeF')),
    ).toBeTruthy();
  });
});
