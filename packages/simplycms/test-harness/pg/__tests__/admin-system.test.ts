// К3-Е6б, Task 3: профіль магазину й логотип проти живої БД (Review Focus 1, 2).
// 🔴 serverFn тут НЕ викликаються (getRequest() без ALS падає) — requireGrant
// мокається модульно, операції беруться з `simplycms/admin-server/impl`.
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

import {
  getSystemSettingsOp,
  saveStoreProfileOp,
} from 'simplycms/admin-server/impl';

describe('admin: профіль магазину й логотип (Е6б, Task 3)', () => {
  const db = F.useSystemAdminDb('simplycms_admin_system');
  const url = () => db.url();
  const root = () => db.root();
  const logo = (entityType?: string) => F.seedMedia(url(), root(), entityType);
  const state = (ref: string) => F.mediaState(url(), root(), ref);
  const both = { row: true, file: true };
  const none = { row: false, file: false };

  it('saveStoreProfile пише профіль; getSystemSettings читає його ж', async () => {
    const input = F.profile();
    await expect(saveStoreProfileOp({ data: input })).resolves.toEqual(input);
    expect(await F.profileValue(url())).toEqual(input);
    const settings = await getSystemSettingsOp();
    expect(settings.profile).toEqual(input);
  });

  it('storeProfileInput відкидає невідомі ключі — у jsonb лише контракт', async () => {
    const input = F.profile();
    const extra = {
      ...input,
      admin: true,
      contacts: { ...input.contacts, fax: '1' },
    };
    await expect(saveStoreProfileOp({ data: extra as never })).resolves.toEqual(
      input,
    );
    expect(await F.profileValue(url())).toEqual(input);
  });

  it('contacts.email обрізається ДО перевірки формату', async () => {
    const input = F.profile();
    const padded = { ...input.contacts, email: '  shop@example.com ' };
    await saveStoreProfileOp({ data: { ...input, contacts: padded } });
    expect(await F.profileValue(url())).toMatchObject({
      contacts: { email: 'shop@example.com' },
    });
  });

  it('заміна логотипа: старий рядок media і файл стерто, новий на місці (одна транзакція)', async () => {
    const first = await logo();
    await saveStoreProfileOp({ data: F.profile({ logo: first }) });
    const second = await logo();
    await saveStoreProfileOp({ data: F.profile({ logo: second }) });
    expect(await state(first)).toEqual(none);
    expect(await state(second)).toEqual(both);
    expect(await F.profileValue(url())).toMatchObject({ logo: second });

    // Прибирання логотипа (`null`) — той самий шлях: стирається останнім кроком.
    await saveStoreProfileOp({ data: F.profile({ logo: null }) });
    expect(await state(second)).toEqual(none);
    expect(await F.profileValue(url())).toMatchObject({ logo: null });
  });

  it('logo = "https://evil.example/x.png" → store_logo_invalid; профіль і media незмінні', async () => {
    const current = await logo();
    await saveStoreProfileOp({ data: F.profile({ logo: current }) });
    const before = await F.profileValue(url());
    const media = await F.rows(
      url(),
      'select id from public.media order by id',
    );

    await expect(
      saveStoreProfileOp({
        data: F.profile({ name: 'Інша', logo: 'https://evil.example/x.png' }),
      }),
    ).rejects.toMatchObject(F.stateConflict('store_logo_invalid'));
    expect(await F.profileValue(url())).toEqual(before);
    expect(
      await F.rows(url(), 'select id from public.media order by id'),
    ).toEqual(media);
  });

  it('logo = референс media з entity_type product → store_logo_invalid', async () => {
    const foreign = await logo('product');
    const before = await F.profileValue(url());
    await expect(
      saveStoreProfileOp({ data: F.profile({ logo: foreign }) }),
    ).rejects.toMatchObject(F.stateConflict('store_logo_invalid'));
    expect(await F.profileValue(url())).toEqual(before);
    expect(await state(foreign)).toEqual(both);
  });

  it('saveStoreProfile впав (store_logo_invalid) → старий логотип: рядок media і файл на місці', async () => {
    const current = await logo();
    await saveStoreProfileOp({ data: F.profile({ logo: current }) });
    const foreign = await logo('product');

    await expect(
      saveStoreProfileOp({ data: F.profile({ logo: foreign }) }),
    ).rejects.toMatchObject(F.stateConflict('store_logo_invalid'));
    expect(await state(current)).toEqual(both);
    expect(await F.profileValue(url())).toMatchObject({ logo: current });
  });

  it('socials з http:// і javascript: → 400 (AdminValidationError), профіль незмінний', async () => {
    const before = await F.profileValue(url());
    for (const bad of ['http://instagram.com/shop', 'javascript:alert(1)']) {
      const data = F.profile({ socials: [{ network: 'instagram', url: bad }] });
      await expect(saveStoreProfileOp({ data })).rejects.toMatchObject({
        name: 'ValidationError',
      });
    }
    expect(await F.profileValue(url())).toEqual(before);
  });

  it('рядка store_profile немає → getSystemSettings віддає порожній профіль; saveStoreProfile створює рядок', async () => {
    await F.rows(
      url(),
      `delete from public.system_settings where key = 'store_profile'`,
    );
    const settings = await getSystemSettingsOp();
    expect(settings.profile).toMatchObject({
      name: '',
      logo: null,
      socials: [],
    });

    const input = F.profile({ name: 'Відновлений' });
    await saveStoreProfileOp({ data: input });
    const [row] = await F.rows(
      url(),
      `select id, value from public.system_settings where key = 'store_profile'`,
    );
    expect(row?.value).toEqual(input);
    // `id` генерує викликач (Категорія A): рядок створено, а не вставлено дефолтом.
    expect(row?.id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
