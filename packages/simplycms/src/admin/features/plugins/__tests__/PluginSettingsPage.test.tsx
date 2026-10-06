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
import { ENTITY, entityKey } from 'simplycms/contracts/entities';
import type { PluginRow } from 'simplycms/admin-server';
import type { PluginModule } from 'simplycms/plugins';
import { makeWrapper } from '../../settings/__tests__/render-support';
import { pluginRow } from './plugin-rows';

const { toastError, toastSuccess, pluginConfigWrite } = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  pluginConfigWrite: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: { error: toastError, success: toastSuccess },
}));
vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ pluginId: 'id-hello' }),
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));
vi.mock('simplycms/plugin-sdk/server', () => ({ pluginConfigWrite }));
vi.mock('simplycms/plugins', async (importOriginal) => {
  const actual = await importOriginal<typeof import('simplycms/plugins')>();
  const { z: zod } = await import('zod');
  actual.registerPluginModule('hello', {
    register: () => {},
    definition: {
      settings: zod.object({
        greeting: zod.string().default('Hi').describe('Greeting'),
        times: zod.number().int().min(1).default(1).describe('Times'),
      }),
    },
  } as unknown as PluginModule);
  return actual;
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

import PluginSettingsPage from '../PluginSettingsPage';

const t = createTranslator('uk');
const KEY = entityKey(ENTITY.plugins).all();
let client: QueryClient;

const open = async () => {
  render(<PluginSettingsPage />, { wrapper: makeWrapper(client) });
  return (await screen.findByLabelText('Greeting')) as HTMLInputElement;
};
const save = () =>
  fireEvent.click(screen.getByRole('button', { name: t('common.save') }));

beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mocks.listPlugins.mockResolvedValue([pluginRow('hello', true)]);
  pluginConfigWrite.mockResolvedValue(undefined);
});
afterEach(() => cleanup());

describe('PluginSettingsPage', () => {
  it('config проходить схему плагіна, пишеться pluginConfigWrite з дефолтами і лягає в кеш', async () => {
    const greeting = await open();
    fireEvent.change(greeting, { target: { value: 'Hey' } });
    save();

    await waitFor(() =>
      expect(pluginConfigWrite).toHaveBeenCalledWith({
        data: { plugin: 'hello', config: { greeting: 'Hey', times: 1 } },
      }),
    );
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(t('common.settingsSaved')),
    );
    expect(client.getQueryData<PluginRow[]>(KEY)?.[0]?.config).toEqual({
      greeting: 'Hey',
      times: 1,
    });
    expect(mocks.listPlugins).toHaveBeenCalledTimes(1);
  });

  it('config не пройшов схему → запиту немає, тост', async () => {
    await open();
    fireEvent.change(screen.getByLabelText('Times'), {
      target: { value: '0' },
    });
    save();

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(pluginConfigWrite).not.toHaveBeenCalled();
  });
});
