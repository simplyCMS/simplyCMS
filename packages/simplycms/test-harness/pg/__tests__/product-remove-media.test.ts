// М1 Task 11: products.remove стирає файли товару ПІСЛЯ коміту (Е6д-14), як
// старий generic remove; команда з реєстру отримує це через ctx.afterCommit.
import { randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { productsRemove } from 'simplycms/admin-server/impl';
import { withActor } from 'simplycms/db';
import { writeMedia } from 'simplycms/storage';
import { useAddressingDb } from './fixtures/addressing-db';
import { create, exec, saveDescription } from './fixtures/product-aggregate';

describe('products.remove: файли після коміту', () => {
  const state = { root: '' };
  // Корінь монтується ДО першого `getMediaDriver()`: драйвер мемоізований.
  beforeAll(() => {
    state.root = mkdtempSync(join(tmpdir(), 'simplycms-product-remove-'));
    process.env.MEDIA_ROOT = state.root;
  });
  afterAll(() => {
    rmSync(state.root, { recursive: true, force: true });
    delete process.env.MEDIA_ROOT;
  });
  const db = useAddressingDb('simplycms_product_remove_media');

  it('файл фото товару стертий, рядок media і outbox порожні', async () => {
    const { id, version } = await create({ uk: { name: 'Фото' } });
    const ref = (
      await withActor({ role: 'app_admin' }, (tx) =>
        writeMedia(tx, {
          bytes: Uint8Array.from([0x89, 0x50, 0x4e, 0x47]),
          mime: 'image/png',
          entityType: 'product',
          entityId: id,
          uploadedBy: null,
        }),
      )
    ).ref;
    // Фото — рядком `product_images` командою агрегата (jsonb `images` знесено, М1).
    const saved = await saveDescription(id, version, {
      images: { upsert: [{ id: randomUUID(), storageKey: ref, sortOrder: 0 }] },
    });
    expect(existsSync(join(state.root, ref))).toBe(true);
    await exec(productsRemove, { id, expectedVersion: saved.version });
    expect(existsSync(join(state.root, ref))).toBe(false);
    expect(
      await db.q(`select 1 from public.media where storage_key = $1`, [ref]),
    ).toHaveLength(0);
    expect(
      await db.q(`select 1 from public.media_erasures where storage_key = $1`, [
        ref,
      ]),
    ).toHaveLength(0);
  });
});
