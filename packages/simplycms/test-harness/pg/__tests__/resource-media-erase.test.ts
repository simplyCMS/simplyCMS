// К3-Е6д, Task 2 (Е6д-14/16): двофазне стирання у фабриці ресурсів. Транзакція
// видаляє лише рядки `media`, файли — `completeMediaErasures` ПІСЛЯ COMMIT. Обриви —
// реальним драйвером зі шпигуном на `delete`, не моком сховища.
import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import { withActor } from 'simplycms/db';
import { media } from 'simplycms/schema';
import { getMediaDriver } from 'simplycms/storage';
import {
  bannerMediaOps as ops,
  useBannerMediaDb,
} from './fixtures/resource-media';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: null, roles: ['admin'] },
    scope: 'any',
  })),
}));

describe('фабрика ресурсів: двофазне стирання media (Е6д-14)', () => {
  const d = useBannerMediaDb('simplycms_e6d_resource_media_erase');
  const create = async (patch: Record<string, unknown> = {}) => {
    const id = crypto.randomUUID();
    const imageUrl = await d.upload(id);
    await ops.insert({ data: [{ id, title: 'Банер', imageUrl, ...patch }] });
    return { id, imageUrl };
  };

  it('9: транзакція впала ПІСЛЯ стирання рядка media → усе на місці, delete не кликано', async () => {
    const { id, imageUrl: old } = await create();
    const next = await d.upload(id);
    const discard: string[] = [];
    const spy = vi.spyOn(getMediaDriver(), 'delete');
    try {
      await expect(
        withActor({ role: 'app_admin' }, async (tx) => {
          await ops.updateIn(tx, [{ id, patch: { imageUrl: next } }], discard);
          // Крок стирання вже відбувся: рядка старого `media` у транзакції немає.
          const left = await tx
            .select({ id: media.id })
            .from(media)
            .where(eq(media.storageKey, old));
          expect(left).toEqual([]);
          throw new Error('обрив після стирання');
        }),
      ).rejects.toThrow('обрив після стирання');
      expect(discard).toEqual([old]);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
    expect(await d.banner(id)).toMatchObject({ image_url: old });
    expect(await d.mediaCount(old)).toBe(1);
    expect(d.hasFile(old)).toBe(true);
  });

  it('9а: discard впав після COMMIT → запис є, рядка media немає, файл — орфан', async () => {
    const { id, imageUrl: old } = await create();
    const next = await d.upload(id);
    const spy = vi
      .spyOn(getMediaDriver(), 'delete')
      .mockRejectedValue(new Error('disk'));
    try {
      await ops.update({ data: [{ id, patch: { imageUrl: next } }] });
      expect(spy).toHaveBeenCalledWith(old);
    } finally {
      spy.mockRestore();
    }
    expect(await d.banner(id)).toMatchObject({ image_url: next });
    expect(await d.mediaCount(old)).toBe(0);
    expect(d.hasFile(old)).toBe(true);
    expect(d.hasFile(next)).toBe(true);
  });

  it('9б: спільний ключ у двох колонках — заміна однієї не стирає файл', async () => {
    const id = crypto.randomUUID();
    const shared = await d.upload(id);
    await ops.insert({
      data: [{ id, title: 'Б', imageUrl: shared, desktopImageUrl: shared }],
    });
    const next = await d.upload(id);
    await ops.update({ data: [{ id, patch: { imageUrl: next } }] });
    expect(d.hasFile(shared)).toBe(true);
    expect(await d.mediaCount(shared)).toBe(1);
  });

  it('9в: remove, delete падає на ДРУГОМУ файлі → банер і обидва рядки media видалено', async () => {
    const id = crypto.randomUUID();
    const refs = [await d.upload(id), await d.upload(id)];
    await ops.insert({
      data: [{ id, title: 'Б', imageUrl: refs[0]!, mobileImageUrl: refs[1]! }],
    });
    const driver = getMediaDriver();
    const real = driver.delete.bind(driver);
    let calls = 0;
    const spy = vi.spyOn(driver, 'delete').mockImplementation(async (key) => {
      if (++calls === 2) throw new Error('disk');
      return real(key);
    });
    try {
      await expect(ops.remove({ data: [{ id }] })).resolves.toEqual({
        count: 1,
      });
    } finally {
      spy.mockRestore();
    }
    expect(calls).toBe(2);
    expect(await d.banner(id)).toBeUndefined();
    for (const ref of refs) expect(await d.mediaCount(ref)).toBe(0);
    // Рівно один файл лишився орфаном — референсів на нього немає.
    expect(refs.filter((ref) => d.hasFile(ref))).toHaveLength(1);
  });

  it('9д: ключ банера A в рядку банера B (повз перевірку) → remove B не чіпає файл A', async () => {
    const a = await create();
    const b = await create();
    await d.q(
      `update public.banners set desktop_image_url = $1 where id = $2`,
      [a.imageUrl, b.id],
    );
    await ops.remove({ data: [{ id: b.id }] });
    expect(d.hasFile(b.imageUrl)).toBe(false);
    expect(d.hasFile(a.imageUrl)).toBe(true);
    expect(await d.mediaCount(a.imageUrl)).toBe(1);
  });

  it('db-варіанти media-ресурсу без колектора discard — помилка програміста', async () => {
    const { id } = await create();
    await expect(
      withActor({ role: 'app_admin' }, (tx) =>
        ops.updateIn(tx, [{ id, patch: { title: 'X' } }]),
      ),
    ).rejects.toThrow(/discard/);
    await expect(
      withActor({ role: 'app_admin' }, (tx) => ops.removeIn(tx, [{ id }])),
    ).rejects.toThrow(/discard/);
    expect(await d.banner(id)).toMatchObject({ title: 'Банер' });
  });
});
