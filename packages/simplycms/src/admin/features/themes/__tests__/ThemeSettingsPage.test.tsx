// @vitest-environment jsdom
import type { ReactNode } from 'react';
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
import type { ThemeSettingDefinition } from 'simplycms/themes/types';
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
  useParams: () => ({ themeId: 'id-solarstore' }),
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));

// Усі пʼять типів `ThemeSettingDefinition` (Review Focus 5).
const SCHEMA: Record<string, ThemeSettingDefinition> = {
  accent: { type: 'color', default: '#ff0000', label: 'Accent' },
  sticky: { type: 'boolean', default: false, label: 'Sticky header' },
  layout: {
    type: 'select',
    default: 'grid',
    label: 'Layout',
    options: [
      { value: 'grid', label: 'Grid' },
      { value: 'list', label: 'List' },
    ],
  },
  tagline: { type: 'text', default: 'Hello', label: 'Tagline' },
  perPage: { type: 'number', default: 12, label: 'Per page', min: 4, max: 48 },
};
vi.mock('simplycms/themes/ThemeRegistry', () => ({
  ThemeRegistry: {
    has: () => true,
    load: async () => ({ settings: SCHEMA }),
  },
}));

const mocks = vi.hoisted(() => ({
  listThemes: vi.fn(),
  saveThemeSettings: vi.fn(),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock(mocks),
);

import ThemeSettingsPage from '../ThemeSettingsPage';

const t = createTranslator('uk');
let client: QueryClient;

const open = async () => {
  render(<ThemeSettingsPage />, { wrapper: makeWrapper(client) });
  return (await screen.findByLabelText('Per page')) as HTMLInputElement;
};

beforeEach(() => {
  vi.clearAllMocks();
  invalidate.mockResolvedValue(undefined);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mocks.listThemes.mockResolvedValue([
    themeRow('default', true),
    themeRow('solarstore', false, { perPage: 8 }),
  ]);
  mocks.saveThemeSettings.mockImplementation(async ({ data }) =>
    themeRow(data.name, false, data.settings),
  );
});
afterEach(() => cleanup());

describe('ThemeSettingsPage', () => {
  it('рендерить усі пʼять типів: text — Input, number — Input type=number з min/max', async () => {
    const perPage = await open();
    expect(perPage.type).toBe('number');
    expect(perPage.min).toBe('4');
    expect(perPage.max).toBe('48');
    // Збережене значення перекриває дефолт схеми.
    expect(perPage.value).toBe('8');

    const tagline = screen.getByLabelText('Tagline') as HTMLInputElement;
    expect(tagline.tagName).toBe('INPUT');
    expect(tagline.type).toBe('text');
    expect(tagline.value).toBe('Hello');
    expect((screen.getByLabelText('Accent') as HTMLInputElement).type).toBe(
      'color',
    );
    expect(screen.getByRole('switch', { name: 'Sticky header' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Layout' })).toBeTruthy();
  });

  it('зберігає number ЧИСЛОМ і скидає кеш роутера', async () => {
    const perPage = await open();
    fireEvent.change(perPage, { target: { value: '24' } });
    fireEvent.change(screen.getByLabelText('Tagline'), {
      target: { value: 'Hi' },
    });
    fireEvent.click(screen.getByRole('button', { name: t('common.save') }));

    await waitFor(() => expect(mocks.saveThemeSettings).toHaveBeenCalled());
    expect(mocks.saveThemeSettings).toHaveBeenCalledWith({
      data: {
        name: 'solarstore',
        settings: {
          accent: '#ff0000',
          sticky: false,
          layout: 'grid',
          tagline: 'Hi',
          perPage: 24,
        },
      },
    });
    const sent = mocks.saveThemeSettings.mock.calls[0]![0].data.settings;
    expect(typeof sent.perPage).toBe('number');
    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(1));
    expect(toastSuccess).toHaveBeenCalledWith(t('common.settingsSaved'));
    expect(toastError).not.toHaveBeenCalled();
  });
});
