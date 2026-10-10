// К3-Е6д, Task 2 (Е6д-1): опція `media` фабрики ресурсів — перевірка нових
// референсів і стирання замінених/видалених файлів. Реальний `localFsDriver`
// у тимчасовому `MEDIA_ROOT`; обриви транзакції й драйвера — у
// `resource-media-erase.test.ts`.
import { describe, expect, it, vi } from 'vitest';
import * as M from '../../../src/admin-server/impl/resource-media';
import { conflict } from './fixtures/admin-shipping';
import {
  bannerMediaOps as ops,
  DATA_REF,
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
// Обгортка-шпигун над `readSnapshot` (кейс 10): ESM-експорт напряму не шпигується.
vi.mock('../../../src/admin-server/impl/resource-media', async (orig) => {
  const m =
    await orig<
      typeof import('../../../src/admin-server/impl/resource-media')
    >();
  return { ...m, readSnapshot: vi.fn(m.readSnapshot) };
});

const invalid = conflict('state', 'media_ref_invalid');

describe('фабрика ресурсів: опція media (Е6д-1)', () => {
  const d = useBannerMediaDb('simplycms_e6d_resource_media');
  const create = async (patch: Record<string, unknown> = {}) => {
    const id = crypto.randomUUID();
    const imageUrl = await d.upload(id);
    await ops.insert({ data: [{ id, title: 'Банер', imageUrl, ...patch }] });
    return { id, imageUrl };
  };

  it('1: insert з референсом свого media → OK', async () => {
    const { id, imageUrl } = await create();
    expect(await d.banner(id)).toMatchObject({ image_url: imageUrl });
    expect(d.hasFile(imageUrl)).toBe(true);
  });

  it('2: insert з референсом media іншого банера → 409, рядка немає, чужий файл цілий', async () => {
    const other = await create();
    const id = crypto.randomUUID();
    await expect(
      ops.insert({ data: [{ id, title: 'Чужий', imageUrl: other.imageUrl }] }),
    ).rejects.toMatchObject(invalid);
    expect(await d.banner(id)).toBeUndefined();
    expect(d.hasFile(other.imageUrl)).toBe(true);
    expect(await d.mediaCount(other.imageUrl)).toBe(1);
  });

  it('3: insert з референсом media типу product → 409', async () => {
    const id = crypto.randomUUID();
    const imageUrl = await d.upload(id, 'product');
    await expect(
      ops.insert({ data: [{ id, title: 'Товарний', imageUrl }] }),
    ).rejects.toMatchObject(invalid);
    expect(await d.banner(id)).toBeUndefined();
  });

  it('4: update imageUrl старий → новий: старий файл і рядок зникли, новий на місці', async () => {
    const { id, imageUrl: old } = await create();
    const next = await d.upload(id);
    await ops.update({ data: [{ id, patch: { imageUrl: next } }] });
    expect(await d.banner(id)).toMatchObject({ image_url: next });
    expect(d.hasFile(old)).toBe(false);
    expect(await d.mediaCount(old)).toBe(0);
    expect(d.hasFile(next)).toBe(true);
    expect(await d.mediaCount(next)).toBe(1);
  });

  it('5: update desktopImageUrl → null: файл стерто', async () => {
    const id = crypto.randomUUID();
    const [imageUrl, desktop] = [await d.upload(id), await d.upload(id)];
    await ops.insert({
      data: [{ id, title: 'Б', imageUrl, desktopImageUrl: desktop }],
    });
    await ops.update({ data: [{ id, patch: { desktopImageUrl: null } }] });
    expect(d.hasFile(desktop)).toBe(false);
    expect(await d.mediaCount(desktop)).toBe(0);
    expect(d.hasFile(imageUrl)).toBe(true);
  });

  it('6: update лише title при data:-картинці → OK, нічого не стерто', async () => {
    const id = crypto.randomUUID();
    await d.q(
      `insert into public.banners (id, title, image_url) values ($1, 'Демо', $2)`,
      [id, DATA_REF],
    );
    await ops.update({ data: [{ id, patch: { title: 'Нова' } }] });
    expect(await d.banner(id)).toMatchObject({
      title: 'Нова',
      image_url: DATA_REF,
    });
  });

  it('7: update на data:-референс, якого не було → 409', async () => {
    const { id, imageUrl } = await create();
    await expect(
      ops.update({ data: [{ id, patch: { imageUrl: DATA_REF } }] }),
    ).rejects.toMatchObject(invalid);
    expect(await d.banner(id)).toMatchObject({ image_url: imageUrl });
    expect(d.hasFile(imageUrl)).toBe(true);
  });

  it('8: remove → рядок і всі три файли зникли', async () => {
    const id = crypto.randomUUID();
    const refs = [await d.upload(id), await d.upload(id), await d.upload(id)];
    await ops.insert({
      data: [
        {
          id,
          title: 'Б',
          imageUrl: refs[0]!,
          desktopImageUrl: refs[1]!,
          mobileImageUrl: refs[2]!,
        },
      ],
    });
    await expect(ops.remove({ data: [{ id }] })).resolves.toEqual({ count: 1 });
    expect(await d.banner(id)).toBeUndefined();
    for (const ref of refs) {
      expect(d.hasFile(ref)).toBe(false);
      expect(await d.mediaCount(ref)).toBe(0);
    }
  });

  it('10: знімок один — один readSnapshot на update з двома рядками', async () => {
    const [a, b] = [await create(), await create()];
    vi.mocked(M.readSnapshot).mockClear();
    await ops.update({
      data: [
        { id: a.id, patch: { title: 'A' } },
        { id: b.id, patch: { title: 'B' } },
      ],
    });
    expect(M.readSnapshot).toHaveBeenCalledTimes(1);
  });
});
