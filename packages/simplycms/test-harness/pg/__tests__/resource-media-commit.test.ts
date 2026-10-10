// К3-Е6д, фінальне рев'ю (М2): порядок «файл після COMMIT» у ПУБЛІЧНИХ
// операціях фабрики. Кейс 9 (`resource-media-erase`) кличе `updateIn` у своїй
// транзакції — повз обгортку `runThenDiscard`, тож перенесення `discardAll`
// усередину `run` він не бачить. Тут COMMIT падає вже ПІСЛЯ тіла операції.
import { describe, expect, it, vi } from 'vitest';
import { getMediaDriver } from 'simplycms/storage';
import { blockCommitOn } from './fixtures/commit-block';
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

describe('фабрика ресурсів: COMMIT впав → файли цілі (Е6д-14)', () => {
  const d = useBannerMediaDb('simplycms_e6d_resource_media_commit');
  const create = async () => {
    const id = crypto.randomUUID();
    const imageUrl = await d.upload(id);
    await ops.insert({ data: [{ id, title: 'Банер', imageUrl }] });
    return { id, imageUrl };
  };

  /** Операція під тригером, що падає на COMMIT; шпигун — на `driver.delete`. */
  const underBlockedCommit = async (
    event: 'update' | 'delete',
    call: () => Promise<unknown>,
  ) => {
    const spy = vi.spyOn(getMediaDriver(), 'delete');
    const unblock = await blockCommitOn((sql) => d.q(sql), 'banners', event);
    try {
      await expect(call()).rejects.toThrow(/commit blocked/);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      await unblock();
      spy.mockRestore();
    }
  };

  it('ops.update: заміна картинки, COMMIT впав → старий файл і рядок media на місці', async () => {
    const { id, imageUrl: old } = await create();
    const next = await d.upload(id);
    await underBlockedCommit('update', () =>
      ops.update({ data: [{ id, patch: { imageUrl: next } }] }),
    );
    expect(await d.banner(id)).toMatchObject({ image_url: old });
    expect(await d.mediaCount(old)).toBe(1);
    expect(d.hasFile(old)).toBe(true);
  });

  it('ops.remove: COMMIT впав → банер, рядок media і файл на місці', async () => {
    const { id, imageUrl } = await create();
    await underBlockedCommit('delete', () => ops.remove({ data: [{ id }] }));
    expect(await d.banner(id)).toMatchObject({ image_url: imageUrl });
    expect(await d.mediaCount(imageUrl)).toBe(1);
    expect(d.hasFile(imageUrl)).toBe(true);
  });
});
