// К3-Е6б, Е6б-24: лок `store-profile` у saveStoreProfileOp — детерміновано
// (`holdAdvisoryLock`/`stillPending` + черга локу), а не випадковою гонкою.
// Без локу два збереження з різними новими логотипами читають той самий
// «попередній», і програшний новий логотип лишається сиротою в `media`.
import { describe, expect, it, vi } from 'vitest';
import { holdAdvisoryLock, stillPending } from './fixtures/advisory-lock';
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

const LOCK = 'store-profile';

describe('admin: лок профілю магазину (Е6б-24)', () => {
  const db = F.useSystemAdminDb('simplycms_admin_system_profile_locks');
  const url = () => db.url();
  const logo = () => F.seedMedia(url(), db.root());
  const storeLogos = async () =>
    (
      await F.rows(
        url(),
        `select storage_key from public.media where entity_type = 'store_logo'`,
      )
    ).map((r) => r.storage_key);

  it('(а) saveStoreProfile стоїть, поки зовнішній тримає store-profile; після release — записано', async () => {
    const before = await F.profileValue(url());
    const lock = await holdAdvisoryLock(url(), LOCK);
    try {
      const op = saveStoreProfileOp({ data: F.profile({ name: 'Під локом' }) });
      expect(await stillPending(op, 300)).toBe(true);
      expect(await F.profileValue(url())).toEqual(before);
      await lock.release();
      await expect(op).resolves.toMatchObject({ name: 'Під локом' });
      expect(await F.profileValue(url())).toMatchObject({ name: 'Під локом' });
    } finally {
      await lock.cleanup();
    }
  });

  it('(б) два збереження з різними новими логотипами під локом → один store_logo, і профіль посилається на нього', async () => {
    const previous = await logo();
    await saveStoreProfileOp({ data: F.profile({ logo: previous }) });
    const [first, second] = [await logo(), await logo()];

    const lock = await holdAdvisoryLock(url(), LOCK);
    try {
      // Черга локу — FIFO: друге збереження стає за першим і виконується другим.
      const a = saveStoreProfileOp({ data: F.profile({ logo: first }) });
      await F.untilAdvisoryWaiters(url(), 1);
      const b = saveStoreProfileOp({ data: F.profile({ logo: second }) });
      await F.untilAdvisoryWaiters(url(), 2);
      await lock.release();
      await expect(Promise.all([a, b])).resolves.toHaveLength(2);
    } finally {
      await lock.cleanup();
    }
    // `first` став «попереднім» для другого збереження і стертий ним.
    expect(await storeLogos()).toEqual([second]);
    expect(await F.profileValue(url())).toMatchObject({ logo: second });
  });
});
