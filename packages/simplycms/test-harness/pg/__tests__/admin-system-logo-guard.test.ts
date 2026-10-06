// К3-Е6б, Е6б-24: старий логотип стирається, ЛИШЕ якщо його рядок `media` —
// `store_logo`. Профіль, зіпсований повз операцію (ручний SQL, імпорт), може
// посилатись на фото товару; заміна чи прибирання такого «логотипа» не має
// права необоротно стерти чужий файл. Окремий файл — ліміт 150 рядків.
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

import { saveStoreProfileOp } from 'simplycms/admin-server/impl';

describe('admin: чужий референс у збереженому профілі (Е6б-24)', () => {
  const db = F.useSystemAdminDb('simplycms_admin_system_logo_guard');
  const url = () => db.url();
  const state = (ref: string) => F.mediaState(url(), db.root(), ref);
  const both = { row: true, file: true };

  /** Профіль із `logo` = фото товару — повз `saveStoreProfileOp` (той не пустить). */
  async function corruptedProfile(): Promise<string> {
    const foreign = await F.seedMedia(url(), db.root(), 'product');
    await F.rows(
      url(),
      `insert into public.system_settings (id, key, value)
       values ($1, 'store_profile', $2::jsonb)
       on conflict (key) do update set value = excluded.value`,
      [crypto.randomUUID(), JSON.stringify(F.profile({ logo: foreign }))],
    );
    return foreign;
  }

  it('прибирання (logo: null) не стирає фото товару: рядок media і файл на місці', async () => {
    const foreign = await corruptedProfile();
    await saveStoreProfileOp({ data: F.profile({ logo: null }) });
    expect(await state(foreign)).toEqual(both);
    expect(await F.profileValue(url())).toMatchObject({ logo: null });
  });

  it('заміна на валідний store_logo не стирає фото товару; новий логотип на місці', async () => {
    const foreign = await corruptedProfile();
    const fresh = await F.seedMedia(url(), db.root());
    await saveStoreProfileOp({ data: F.profile({ logo: fresh }) });
    expect(await state(foreign)).toEqual(both);
    expect(await state(fresh)).toEqual(both);
    expect(await F.profileValue(url())).toMatchObject({ logo: fresh });
  });
});
