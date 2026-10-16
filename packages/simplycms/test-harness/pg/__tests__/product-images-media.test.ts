// М1 Task 12: зображення агрегата товару й медіа-контур «об'єкт → рядок»
// (Е6д-1/14/20/22) проти живого Postgres і файлової медіатеки.
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
  productModificationsOps,
  productsOps,
  productsRemove,
  sweepUnreferencedMediaOp,
} from 'simplycms/admin-server/impl';
import {
  AdminConflictError,
  ValidationError,
} from 'simplycms/contracts/domain-errors';
import { withActor } from 'simplycms/db';
import {
  completeMediaErasures,
  findMediaReferences,
  getMediaDriver,
  writeMedia,
} from 'simplycms/storage';
import { useAddressingDb } from './fixtures/addressing-db';
import { create, exec, saveDescription } from './fixtures/product-aggregate';

describe('зображення товару й медіа-контур (Task 12)', () => {
  const state = { root: '' };
  // Корінь монтується ДО першого `getMediaDriver()`: драйвер мемоізований.
  beforeAll(() => {
    state.root = mkdtempSync(join(tmpdir(), 'simplycms-product-images-'));
    process.env.MEDIA_ROOT = state.root;
  });
  afterAll(() => {
    rmSync(state.root, { recursive: true, force: true });
    delete process.env.MEDIA_ROOT;
  });
  const db = useAddressingDb('simplycms_product_images');
  beforeAll(async () => {
    await db.language('en');
    await db.language('de');
  });

  /** Завантажений файл товару (рядок `media` + файл). */
  const upload = async (productId: string, entityType = 'product') =>
    (
      await withActor({ role: 'app_admin' }, (tx) =>
        writeMedia(tx, {
          bytes: Uint8Array.from([0x89, 0x50, 0x4e, 0x47, Math.random() * 255]),
          mime: 'image/png',
          entityType,
          entityId: productId,
          uploadedBy: null,
        }),
      )
    ).ref;
  const onDisk = (ref: string) => existsSync(join(state.root, ref));
  const mediaRow = async (ref: string) =>
    db.q(`select 1 from public.media where storage_key = $1`, [ref]);
  const outbox = async (ref: string) =>
    db.q(`select 1 from public.media_erasures where storage_key = $1`, [ref]);
  const rejects = (p: Promise<unknown>) =>
    p.then(
      () => null,
      (e: unknown) => e,
    );
  const img = (key: string, extra: object = {}) => ({
    id: randomUUID(),
    storageKey: key,
    sortOrder: 0,
    ...extra,
  });
  /** Товар з фото `main` і перевизначенням `en`. */
  const seed = async () => {
    const p = await create({ uk: { name: 'Кабель' } });
    const [main, en] = [await upload(p.id), await upload(p.id)];
    const image = img(main, {
      alt: { uk: 'Кабель', en: 'Cable' },
      overrides: { en },
    });
    const out = await saveDescription(p.id, p.version, {
      images: { upsert: [image] },
    });
    return { ...p, version: out.version, main, en, image };
  };

  it('фото з alt двома мовами; перевизначення en → findMediaReferences бачить обидва ключі', async () => {
    const { image, main, en } = await seed();
    const alts = await db.q(
      `select locale, alt from public.product_image_translations where image_id = $1 order by locale`,
      [image.id],
    );
    expect(alts).toMatchObject([
      { locale: 'en', alt: 'Cable' },
      { locale: 'uk', alt: 'Кабель' },
    ]);
    const refs = (key: string) =>
      withActor({ role: 'app_admin' }, (tx) => findMediaReferences(tx, key));
    expect(await refs(main)).toContainEqual({
      table: 'product_images',
      column: 'storage_key',
      id: image.id,
    });
    expect(await refs(en)).toContainEqual({
      table: 'product_image_translations',
      column: 'storage_key',
      id: `${image.id}:en`,
    });
  });

  it('М1-TEMP: jsonb products.images і product_modifications.images дзеркалять рядки', async () => {
    const { id, version, main } = await seed();
    const [row] = await db.q(
      `select images from public.products where id = $1`,
      [id],
    );
    expect(row!.images).toEqual([main]);
    const mod = randomUUID();
    const key = await upload(id);
    await saveDescription(id, version, {
      modifications: { upsert: [{ id: mod, texts: { uk: { name: 'M' } } }] },
    });
    const v2 = (
      await db.q(`select version from public.products where id = $1`, [id])
    )[0]!.version as number;
    await saveDescription(id, v2, {
      images: { upsert: [img(key, { modificationId: mod })] },
    });
    const [m] = await db.q(
      `select images from public.product_modifications where id = $1`,
      [mod],
    );
    expect(m!.images).toEqual([key]);
  });

  it('remove фото → файл стерто, рядок прибрано, outbox порожній', async () => {
    const { id, version, image, main, en } = await seed();
    await saveDescription(id, version, { images: { remove: [image.id] } });
    for (const key of [main, en]) {
      expect(onDisk(key)).toBe(false);
      expect(await mediaRow(key)).toHaveLength(0);
      expect(await outbox(key)).toHaveLength(0);
    }
    expect(
      await db.q(`select 1 from public.product_images where id = $1`, [
        image.id,
      ]),
    ).toHaveLength(0);
  });

  it('заміна storageKey і зняття перевизначення стирають лише зникле', async () => {
    const { id, version, image, main, en } = await seed();
    const fresh = await upload(id);
    await saveDescription(id, version, {
      images: {
        upsert: [{ ...image, storageKey: fresh, overrides: { en: null } }],
      },
    });
    expect(onDisk(main)).toBe(false);
    expect(onDisk(en)).toBe(false);
    expect(onDisk(fresh)).toBe(true);
  });

  it('видалення модифікації стирає файли її фото', async () => {
    const p = await create({ uk: { name: 'Кабель' } });
    const [mod, key] = [randomUUID(), await upload(p.id)];
    const s1 = await saveDescription(p.id, p.version, {
      modifications: { upsert: [{ id: mod, texts: { uk: { name: 'M' } } }] },
    });
    const s2 = await saveDescription(p.id, s1.version, {
      images: { upsert: [img(key, { modificationId: mod })] },
    });
    await saveDescription(p.id, s2.version, {
      modifications: { remove: [mod] },
    });
    expect(onDisk(key)).toBe(false);
    expect(await mediaRow(key)).toHaveLength(0);
  });

  it('sweep не чіпає ключ, що лежить лише в product_image_translations.storage_key', async () => {
    const { en, main } = await seed();
    await db.q(
      `update public.media set created_at = now() - interval '48 hours' where storage_key = any($1)`,
      [[main, en]],
    );
    await sweepUnreferencedMediaOp();
    expect(await mediaRow(en)).toHaveLength(1);
    expect(onDisk(en)).toBe(true);
    expect(await mediaRow(main)).toHaveLength(1);
  });

  it('чужий ключ (файл іншого товару або іншого типу) → 409 media_ref_invalid; те саме для overrides', async () => {
    const mine = await create({ uk: { name: 'Мій' } });
    const other = await create({ uk: { name: 'Чужий' } });
    const foreign = await upload(other.id);
    const banner = await upload(randomUUID(), 'banner');
    const conflict = async (body: object) => {
      const err = await rejects(saveDescription(mine.id, mine.version, body));
      expect(err).toBeInstanceOf(AdminConflictError);
      expect(err).toMatchObject({
        kind: 'state',
        constraint: 'media_ref_invalid',
      });
    };
    await conflict({ images: { upsert: [img(foreign)] } });
    await conflict({ images: { upsert: [img(banner)] } });
    const own = await upload(mine.id);
    await conflict({
      images: { upsert: [img(own, { overrides: { en: foreign } })] },
    });
    expect(
      await db.q(`select 1 from public.product_images where product_id = $1`, [
        mine.id,
      ]),
    ).toHaveLength(0);
    expect(onDisk(foreign)).toBe(true);
  });

  it('перевизначення основної мови й невідома мова → validation (400 раніше за 412)', async () => {
    const p = await create({ uk: { name: 'Кабель' } });
    const key = await upload(p.id);
    const bad = (extra: object) =>
      rejects(
        saveDescription(p.id, 99, { images: { upsert: [img(key, extra)] } }),
      );
    expect(await bad({ overrides: { uk: key } })).toBeInstanceOf(
      ValidationError,
    );
    expect(await bad({ alt: { zz: 'x' } })).toBeInstanceOf(ValidationError);
    expect(await bad({ modificationId: randomUUID() })).toBeInstanceOf(
      ValidationError,
    );
  });

  it('products.remove стирає файли всіх фото й перевизначень', async () => {
    const { id, version, main, en } = await seed();
    await exec(productsRemove, { id, expectedVersion: version });
    for (const key of [main, en]) {
      expect(onDisk(key)).toBe(false);
      expect(await mediaRow(key)).toHaveLength(0);
      expect(await outbox(key)).toHaveLength(0);
    }
  });

  it('хвіст стирання падає → рядок outbox лишився і добирається наявним механізмом', async () => {
    const { id, version, main, en } = await seed();
    const driver = getMediaDriver();
    const spy = vi
      .spyOn(driver, 'delete')
      .mockRejectedValue(new Error('disk: недоступно'));
    try {
      // Відповідь команди не маскується збоєм хвоста.
      await exec(productsRemove, { id, expectedVersion: version });
    } finally {
      spy.mockRestore();
    }
    for (const key of [main, en]) {
      expect(await mediaRow(key)).toHaveLength(0);
      expect(await outbox(key)).toHaveLength(1);
      expect(onDisk(key)).toBe(true);
    }
    const { retryMediaErasures } = await import('simplycms/storage');
    await retryMediaErasures();
    for (const key of [main, en]) {
      expect(await outbox(key)).toHaveLength(0);
      expect(onDisk(key)).toBe(false);
    }
  });

  it('узагальнений remove (cascadeMedia) також стирає файли фото й перевизначень', async () => {
    const { id, main, en } = await seed();
    const discard: string[] = [];
    await withActor({ role: 'app_admin' }, (tx) =>
      productsOps.removeIn(tx, [{ id }], discard),
    );
    await completeMediaErasures(discard);
    for (const key of [main, en]) {
      expect(onDisk(key)).toBe(false);
      expect(await mediaRow(key)).toHaveLength(0);
    }
  });

  it('узагальнений remove модифікації стирає файли її фото (власник — товар)', async () => {
    const p = await create({ uk: { name: 'Кабель' } });
    const [mod, key] = [randomUUID(), await upload(p.id)];
    const s1 = await saveDescription(p.id, p.version, {
      modifications: { upsert: [{ id: mod, texts: { uk: { name: 'M' } } }] },
    });
    await saveDescription(p.id, s1.version, {
      images: { upsert: [img(key, { modificationId: mod })] },
    });
    const discard: string[] = [];
    await withActor({ role: 'app_admin' }, (tx) =>
      productModificationsOps.removeIn(tx, [{ id: mod }], discard),
    );
    await completeMediaErasures(discard);
    expect(onDisk(key)).toBe(false);
    expect(await mediaRow(key)).toHaveLength(0);
  });
});
