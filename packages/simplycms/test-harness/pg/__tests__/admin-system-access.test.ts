// К3-Е6б, Task 3: склад, плагіни й право `settings.manage` проти живої БД
// (Е6б-13, Е6б-17, Е6б-21; «Додатково» Review Focus: не-адмін → AuthzError, БД незмінна).
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { setResponseStatus } from '@tanstack/react-start/server';
import { AuthzError } from 'simplycms/auth';
import { withActor } from 'simplycms/db';
import { loadStockManagement } from 'simplycms/inventory';
import { savePluginConfig } from '../../../src/plugin-sdk/server/config-db';
import * as F from './fixtures/admin-system';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: null, roles: ['admin'] },
    scope: 'any',
  })),
}));

import {
  activateThemeOp,
  getSystemSettingsOp,
  listPluginsOp,
  listThemesOp,
  saveStockManagementOp,
  saveStoreProfileOp,
  saveThemeSettingsOp,
  setPluginActiveOp,
} from 'simplycms/admin-server/impl';

describe('admin: склад, плагіни, право settings.manage (Е6б, Task 3)', () => {
  const db = F.useSystemAdminDb('simplycms_admin_system_access');
  const url = () => db.url();
  /** Знімок трьох таблиць, які пишуть операції системи. */
  const snapshot = async () => ({
    settings: await F.rows(
      url(),
      'select * from public.system_settings order by key',
    ),
    themes: await F.rows(url(), 'select * from public.themes order by name'),
    plugins: await F.rows(url(), 'select * from public.plugins order by name'),
  });

  beforeAll(async () => {
    await F.rows(
      url(),
      `insert into public.plugins (id, name, display_name, is_active, config)
       values ($1, 'faq', 'FAQ', true, '{"maxVisible": 5}'::jsonb)`,
      [crypto.randomUUID()],
    );
  });

  it('saveStockManagement(false) → value.decrease_on_order = false; loadStockManagement бачить false', async () => {
    await saveStockManagementOp({ data: { decreaseOnOrder: true } });
    await expect(
      saveStockManagementOp({ data: { decreaseOnOrder: false } }),
    ).resolves.toEqual({ decreaseOnOrder: false });
    const [row] = await F.rows(
      url(),
      `select value from public.system_settings where key = 'stock_management'`,
    );
    expect(row?.value).toEqual({ decrease_on_order: false });
    expect(
      await withActor({ role: 'app_admin' }, (tx) => loadStockManagement(tx)),
    ).toEqual({ decrease_on_order: false });
    expect((await getSystemSettingsOp()).stockManagement).toEqual({
      decreaseOnOrder: false,
    });
  });

  it('setPluginActive faq false → is_active false; невідомий → plugin_unknown', async () => {
    const row = await setPluginActiveOp({
      data: { name: 'faq', isActive: false },
    });
    expect(row).toMatchObject({ name: 'faq', isActive: false });
    const [db] = await F.rows(
      url(),
      `select is_active from public.plugins where name = 'faq'`,
    );
    expect(db?.is_active).toBe(false);
    expect((await listPluginsOp()).map((p) => [p.name, p.isActive])).toEqual([
      ['faq', false],
    ]);
    await expect(
      setPluginActiveOp({ data: { name: 'nope', isActive: true } }),
    ).rejects.toMatchObject(F.stateConflict('plugin_unknown'));
  });

  it('pluginConfigWrite: config > 64 КБ → 400, конфіг незмінний', async () => {
    const before = await snapshot();
    const big = { blob: 'x'.repeat(64 * 1024) };
    await expect(savePluginConfig('faq', big)).rejects.toThrow(/64/);
    expect(setResponseStatus).toHaveBeenCalledWith(400);
    expect(await snapshot()).toEqual(before);
    await savePluginConfig('faq', { maxVisible: 7 });
    const [row] = await F.rows(
      url(),
      `select config from public.plugins where name = 'faq'`,
    );
    expect(row?.config).toEqual({ maxVisible: 7 });
  });

  it('не-адмін на кожній операції → AuthzError, БД незмінна', async () => {
    const before = await snapshot();
    const ops: [string, () => Promise<unknown>][] = [
      ['getSystemSettings', () => getSystemSettingsOp()],
      ['saveStoreProfile', () => saveStoreProfileOp({ data: F.profile() })],
      [
        'saveStockManagement',
        () => saveStockManagementOp({ data: { decreaseOnOrder: true } }),
      ],
      ['listThemes', () => listThemesOp()],
      ['activateTheme', () => activateThemeOp({ data: { name: 'default' } })],
      [
        'saveThemeSettings',
        () =>
          saveThemeSettingsOp({
            data: { name: 'default', settings: { a: 1 } },
          }),
      ],
      ['listPlugins', () => listPluginsOp()],
      [
        'setPluginActive',
        () => setPluginActiveOp({ data: { name: 'faq', isActive: true } }),
      ],
      ['pluginConfigWrite', () => savePluginConfig('faq', { maxVisible: 1 })],
    ];
    for (const [name, run] of ops) {
      F.asCustomer();
      await expect(run(), name).rejects.toThrow(AuthzError);
    }
    expect(await snapshot()).toEqual(before);
  });
});
