// Фінальне рев'ю М1 (B-I2, Р14): створення товару з фото — ОДНА команда `products.create`.
// Збій після запису фото відкочує все (товару немає, повтор з тим самим id проходить), а файли,
// завантажені до команди, прибирає наявний sweep.
import { randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig<typeof import('simplycms/auth')>()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: null, roles: ['admin'] },
    scope: 'any',
  })),
}));

import {
  productsCreate,
  sweepUnreferencedMediaOp,
} from 'simplycms/admin-server/impl';
import { withActor } from 'simplycms/db';
import { writeMedia } from 'simplycms/storage';
import { useAddressingDb } from './fixtures/addressing-db';
import { exec } from './fixtures/product-aggregate';

describe('products.create з фото — одна транзакція (B-I2)', () => {
  const state = { root: '' };
  // Корінь монтується ДО першого `getMediaDriver()`: драйвер мемоізований.
  beforeAll(() => {
    state.root = mkdtempSync(join(tmpdir(), 'simplycms-create-images-'));
    process.env.MEDIA_ROOT = state.root;
  });
  afterAll(() => {
    rmSync(state.root, { recursive: true, force: true });
    delete process.env.MEDIA_ROOT;
  });
  const db = useAddressingDb('simplycms_product_create_images');

  /** Файл, завантажений формою «Новий товар» під id наперед — ДО команди. */
  const upload = async (productId: string) =>
    (
      await withActor({ role: 'app_admin' }, (tx) =>
        writeMedia(tx, {
          bytes: Uint8Array.from([0x89, 0x50, 0x4e, 0x47, Math.random() * 255]),
          mime: 'image/png',
          entityType: 'product',
          entityId: productId,
          uploadedBy: null,
        }),
      )
    ).ref;
  const input = (id: string, key: string) => ({
    id,
    texts: { uk: { name: `Товар ${id.slice(0, 8)}` } },
    images: {
      upsert: [
        {
          id: randomUUID(),
          storageKey: key,
          sortOrder: 0,
          alt: { uk: 'Фото' },
        },
      ],
    },
  });
  const count = async (table: string, column: string, id: string) =>
    (await db.q(`select 1 from public.${table} where ${column} = $1`, [id]))
      .length;
  /** Ін'єкція збою ПІСЛЯ запису фото в транзакції команди. */
  const failAfterImages = (on: boolean) =>
    db.q(
      on
        ? `create or replace function public.test_fail_image() returns trigger language plpgsql as $$
             begin raise exception 'ін''єкція збою після запису фото'; end $$;
           create trigger test_fail_image after insert on public.product_images
             for each row execute function public.test_fail_image()`
        : `drop trigger test_fail_image on public.product_images;
           drop function public.test_fail_image()`,
    );

  it('фото записуються тією ж командою, що й товар', async () => {
    const id = randomUUID();
    const key = await upload(id);
    const out = await exec(productsCreate, input(id, key));
    expect(out.version).toBe(1);
    expect(await count('product_images', 'product_id', id)).toBe(1);
  });

  it('збій після запису фото → товару немає; повтор «Створити» з тим самим id проходить', async () => {
    const id = randomUUID();
    const key = await upload(id);
    await failAfterImages(true);
    try {
      // Відмова — саме від ін'єкції (Drizzle загортає помилку БД у `cause`).
      await expect(exec(productsCreate, input(id, key))).rejects.toMatchObject({
        cause: { message: expect.stringMatching(/ін'єкція збою/) },
      });
    } finally {
      await failAfterImages(false);
    }
    expect(await count('products', 'id', id)).toBe(0);
    expect(await count('product_images', 'product_id', id)).toBe(0);
    await exec(productsCreate, input(id, key));
    expect(await count('products', 'id', id)).toBe(1);
    expect(await count('product_images', 'product_id', id)).toBe(1);
  });

  it('файл невдалого створення — сирота, і sweep його бачить і прибирає', async () => {
    const id = randomUUID();
    const key = await upload(id);
    await failAfterImages(true);
    try {
      // Відмова — саме від ін'єкції (Drizzle загортає помилку БД у `cause`).
      await expect(exec(productsCreate, input(id, key))).rejects.toMatchObject({
        cause: { message: expect.stringMatching(/ін'єкція збою/) },
      });
    } finally {
      await failAfterImages(false);
    }
    // Вікно sweep — лише старші за мінімальний вік файли (захист щойно завантажених).
    await db.q(
      `update public.media set created_at = now() - interval '48 hours' where storage_key = $1`,
      [key],
    );
    await sweepUnreferencedMediaOp();
    expect(await count('media', 'storage_key', key)).toBe(0);
    expect(existsSync(join(state.root, key))).toBe(false);
  });
});
