// К3-Е6д, Task 7 (Е6д-14, Е6д-16; переписує Е6г-15): видалення акаунта
// стирає аватар і фото відгуків однією двофазною групою — рядки `media` у
// транзакції, файли ПІСЛЯ COMMIT. Відгук лишається анонімним і без фото.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { withActor } from 'simplycms/db';
import {
  deleteCustomer,
  deleteCustomerInput,
  deleteCustomerOp,
} from 'simplycms/admin-server/impl';
import { ADMIN_ID } from './fixtures/customer-delete';
import { useReviewPhotosDb } from './fixtures/review-photos';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: ADMIN_ID, roles: ['admin'] },
    scope: 'any',
  })),
}));

describe('admin: видалення акаунта з фото відгуків (Е6д-14)', () => {
  const d = useReviewPhotosDb('simplycms_e6d_cust_photos');
  const { f } = d;
  /** Покупець з аватаром і відгуком із двома фото. */
  const seeded = async () => {
    const b = await d.seedBuyer({ avatar: true });
    const id = await d.seedReview({ userId: b.userId });
    const refs = await d.seedPhotos(id, 2);
    return { ...b, id, keys: [b.avatar!, ...refs] };
  };
  const call = (b: { userId: string; email: string }) =>
    deleteCustomerOp({ data: { userId: b.userId, confirmEmail: b.email } });
  const intact = async (b: Awaited<ReturnType<typeof seeded>>) => {
    expect(await d.userExists(b.userId)).toBe(true);
    expect((await d.reviewRow(b.id))!.images).toHaveLength(2);
    for (const k of b.keys) {
      expect(await d.mediaRows(k)).toHaveLength(1);
      expect(d.hasFile(k)).toBe(true);
    }
  };

  afterEach(() => vi.restoreAllMocks());

  it('успіх: відгук анонімний без фото; файли й media фото та аватара зникли', async () => {
    const b = await seeded();
    await expect(call(b)).resolves.toEqual({
      erasedOrders: 0,
      anonymizedReviews: 1,
    });
    expect(await d.reviewRow(b.id)).toMatchObject({
      user_id: null,
      images: [],
    });
    for (const k of b.keys) {
      expect(await d.mediaRows(k)).toEqual([]);
      expect(d.hasFile(k)).toBe(false);
    }
  });

  it('🔴 транзакція впала ПІСЛЯ ядра → покупець, images, media і файли на місці', async () => {
    const b = await seeded();
    const spy = vi.spyOn(d.getMediaDriver(), 'delete');
    await expect(
      withActor({ role: 'app_admin' }, async (db) => {
        await deleteCustomer(
          db,
          deleteCustomerInput.parse({
            userId: b.userId,
            confirmEmail: b.email,
          }),
          { kind: 'system' },
        );
        throw new Error('after core');
      }),
    ).rejects.toThrow('after core');
    expect(spy).not.toHaveBeenCalled();
    await intact(b);
  });

  it('🔴 COMMIT впав → покупець, media і файли на місці, driver.delete не викликано', async () => {
    const b = await seeded();
    const spy = vi.spyOn(d.getMediaDriver(), 'delete');
    const unblock = await d.blockCommit('users');
    try {
      await expect(call(b)).rejects.toThrow();
    } finally {
      await unblock();
    }
    expect(spy).not.toHaveBeenCalled();
    await intact(b);
  });

  it('driver.delete падає на другому файлі → покупця видалено, media немає, один файл — орфан', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const b = await seeded();
    const real = d.getMediaDriver();
    const del = real.delete.bind(real);
    let calls = 0;
    vi.spyOn(real, 'delete').mockImplementation(async (ref: string) => {
      if (++calls === 2) throw new Error('disk');
      return del(ref);
    });
    await expect(call(b)).resolves.toMatchObject({ anonymizedReviews: 1 });
    expect(await d.userExists(b.userId)).toBe(false);
    for (const k of b.keys) expect(await d.mediaRows(k)).toEqual([]);
    expect(b.keys.filter((k) => d.hasFile(k))).toHaveLength(1);
  });

  it('відгук з images = NULL не ламає видалення (M9)', async () => {
    const b = await d.seedBuyer();
    const id = await d.seedReview({ userId: b.userId, images: null });
    await expect(call(b)).resolves.toMatchObject({ anonymizedReviews: 1 });
    expect(await d.reviewRow(id)).toMatchObject({ user_id: null, images: [] });
  });

  it('🔴 чужий ключ (аватар іншого покупця) у відгуку видаленого → аватар і media цілі (Е6д-16)', async () => {
    const b = await seeded();
    const victim = await d.seedBuyer({ avatar: true });
    await f.rows(
      `update public.product_reviews set images = images || $2::jsonb where id = $1`,
      [b.id, JSON.stringify([victim.avatar])],
    );
    await call(b);
    for (const k of b.keys) expect(d.hasFile(k)).toBe(false);
    expect(d.hasFile(victim.avatar!)).toBe(true);
    expect(await d.mediaRows(victim.avatar!)).toHaveLength(1);
  });
});
