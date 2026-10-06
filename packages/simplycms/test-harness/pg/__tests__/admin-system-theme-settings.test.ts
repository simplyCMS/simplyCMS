// К3-Е6б, Task 3: налаштування теми проти живої БД (Review Focus 5, Е6б-16):
// форма значення — плоский словник примітивів, `number` лишається числом.
import { describe, expect, it, vi } from 'vitest';
import * as F from './fixtures/admin-system';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: null, roles: ['admin'] },
    scope: 'any',
  })),
}));

import { saveThemeSettingsOp } from 'simplycms/admin-server/impl';

describe('admin: налаштування теми (Е6б, Task 3)', () => {
  const db = F.useSystemAdminDb('simplycms_admin_system_theme_settings');
  const url = () => db.url();
  const settingsOf = async (name: string) =>
    (
      await F.rows(
        url(),
        'select settings from public.themes where name = $1',
        [name],
      )
    )[0]?.settings;

  it('saveThemeSettings: вкладений обʼєкт → 400; > 16 КБ → 400; рядок незмінний', async () => {
    await saveThemeSettingsOp({
      data: { name: 'default', settings: { accent: 'red' } },
    });
    const before = await settingsOf('default');
    const nested = { name: 'default', settings: { colors: { accent: 'red' } } };
    // 20 рядків по 1000 символів: кожне поле в межах, а сума > 16 КБ.
    const big = Object.fromEntries(
      Array.from({ length: 20 }, (_, i) => [`k${i}`, 'x'.repeat(1000)]),
    );
    for (const data of [nested, { name: 'default', settings: big }])
      await expect(
        saveThemeSettingsOp({ data: data as never }),
      ).rejects.toMatchObject({ name: 'ValidationError' });
    expect(await settingsOf('default')).toEqual(before);
  });

  it('saveThemeSettings: масив, понад 64 ключі, ключ понад 64 символи → 400; рядок незмінний', async () => {
    const before = await settingsOf('default');
    const many = Object.fromEntries(
      Array.from({ length: 65 }, (_, i) => [`k${i}`, i]),
    );
    const cases = [{ list: [1, 2] }, [1, 2], many, { ['k'.repeat(65)]: 'x' }];
    for (const settings of cases)
      await expect(
        saveThemeSettingsOp({ data: { name: 'default', settings } as never }),
      ).rejects.toMatchObject({ name: 'ValidationError' });
    expect(await settingsOf('default')).toEqual(before);
  });

  it('saveThemeSettings { radius: 8, title: "x" } → number лишився number у jsonb', async () => {
    const row = await saveThemeSettingsOp({
      data: { name: 'default', settings: { radius: 8, title: 'x' } },
    });
    expect(row.settings).toEqual({ radius: 8, title: 'x' });
    const [db] = await F.rows(
      url(),
      `select jsonb_typeof(settings->'radius') as t from public.themes where name = 'default'`,
    );
    expect(db?.t).toBe('number');
  });
});
