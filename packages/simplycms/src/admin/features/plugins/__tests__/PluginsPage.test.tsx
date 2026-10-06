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
import { makeWrapper } from '../../settings/__tests__/render-support';
import { pluginRow } from './plugin-rows';

const { toastError, toastSuccess, sync } = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  sync: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: { error: toastError, success: toastSuccess },
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));
vi.mock('simplycms/plugins', async (importOriginal) => {
  const actual = await importOriginal<typeof import('simplycms/plugins')>();
  actual.registerPluginModule('hello', { register: () => {} });
  return { ...actual, syncPluginHooks: sync };
});

const mocks = vi.hoisted(() => ({
  listPlugins: vi.fn(),
  setPluginActive: vi.fn(),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock(mocks),
);

import PluginsPage from '../PluginsPage';

const t = createTranslator('uk');
let client: QueryClient;

beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mocks.listPlugins.mockResolvedValue([pluginRow('hello', true)]);
  mocks.setPluginActive.mockImplementation(async ({ data }) =>
    pluginRow(data.name, data.isActive),
  );
  sync.mockResolvedValue(undefined);
});
afterEach(() => cleanup());

describe('PluginsPage', () => {
  it('С-3: у картці лише перемикач і «Налаштування», кнопки видалення немає', async () => {
    render(<PluginsPage />, { wrapper: makeWrapper(client) });
    const card = await screen.findByRole('group', { name: 'HELLO' });

    expect(within(card).getAllByRole('switch')).toHaveLength(1);
    expect(within(card).getByText(t('admin.nav.settings'))).toBeTruthy();
    expect(within(card).queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByText(t('common.delete'))).toBeNull();
  });

  it('збій listPlugins → повідомлення про помилку завантаження, а не «плагінів немає»', async () => {
    mocks.listPlugins.mockRejectedValue(new TypeError('Failed to fetch'));
    render(<PluginsPage />, { wrapper: makeWrapper(client) });

    expect((await screen.findByRole('alert')).textContent).toBe(
      t('admin.plugins.loadError'),
    );
    expect(screen.queryByText(t('admin.plugins.empty'))).toBeNull();
  });

  it('плагін без модуля: активний можна вимкнути, неактивний — не ввімкнути', async () => {
    mocks.listPlugins.mockResolvedValue([
      pluginRow('orphan', true),
      pluginRow('ghost', false),
    ]);
    render(<PluginsPage />, { wrapper: makeWrapper(client) });
    const orphan = await screen.findByRole('group', { name: 'ORPHAN' });
    const ghost = screen.getByRole('group', { name: 'GHOST' });

    expect(within(orphan).getByRole('switch').hasAttribute('disabled')).toBe(
      false,
    );
    expect(within(ghost).getByRole('switch').hasAttribute('disabled')).toBe(
      true,
    );
  });

  it('перемикач шле setPluginActive і пише відповідь у кеш без refetch', async () => {
    render(<PluginsPage />, { wrapper: makeWrapper(client) });
    const card = await screen.findByRole('group', { name: 'HELLO' });
    const toggle = within(card).getByRole('switch');
    expect(toggle.getAttribute('aria-checked')).toBe('true');

    fireEvent.click(toggle);

    await waitFor(() =>
      expect(toggle.getAttribute('aria-checked')).toBe('false'),
    );
    expect(mocks.setPluginActive).toHaveBeenCalledWith({
      data: { name: 'hello', isActive: false },
    });
    expect(sync).toHaveBeenCalledWith('hello', false);
    expect(mocks.listPlugins).toHaveBeenCalledTimes(1);
    expect(toastError).not.toHaveBeenCalled();
  });
});
