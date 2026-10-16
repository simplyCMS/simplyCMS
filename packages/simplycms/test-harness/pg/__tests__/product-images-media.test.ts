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
  productsSaveDescription,
  sweepUnreferencedMediaOp,
} from 'simplycms/admin-server/impl';
import {
  AdminConflictError,
  ValidationError,
} from 'simplycms/contracts/domain-errors';
import { sql } from 'drizzle-orm';
import { withActor } from 'simplycms/db';
import {
  completeMediaErasures,
  eraseMediaRows,
  findMediaReferences,
  getMediaDriver,
  writeMedia,
} from 'simplycms/storage';
import { useAddressingDb } from './fixtures/addressing-db';
import {
  create,
  exec,
  get,
  saveDescription,
  subject,
} from './fixtures/product-aggregate';

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
    const { id: pid, image, main, en } = await seed();
    const alts = await db.q(
      `select locale, alt from public.product_image_translations where image_id = $1 order by locale`,
      [image.id],
    );
    expect(alts).toMatchObject([
      { locale: 'en', alt: 'Cable' },
      { locale: 'uk', alt: 'Кабель' },
    ]);
    // `products.get` віддає зображення у формі входу `saveDescription`.
    const got = await get(pid);
    expect(got.images).toEqual([
      {
        id: image.id,
        storageKey: main,
        sortOrder: 0,
        alt: { uk: 'Кабель', en: 'Cable' },
        overrides: { en },
      },
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

  describe('ключ, на який ще є посилання, не стирається', () => {
    const alive = async (key: string) => {
      expect(onDisk(key)).toBe(true);
      expect(await mediaRow(key)).toHaveLength(1);
    };

    it('спільний ключ фото товару й фото модифікації: remove модифікації лишає файл і рядок media', async () => {
      const p = await create({ uk: { name: 'Кабель' } });
      const [mod, key] = [randomUUID(), await upload(p.id)];
      const s1 = await saveDescription(p.id, p.version, {
        modifications: { upsert: [{ id: mod, texts: { uk: { name: 'M' } } }] },
      });
      await saveDescription(p.id, s1.version, {
        images: {
          upsert: [img(key), img(key, { modificationId: mod, sortOrder: 1 })],
        },
      });
      const discard: string[] = [];
      await withActor({ role: 'app_admin' }, (tx) =>
        productModificationsOps.removeIn(tx, [{ id: mod }], discard),
      );
      await completeMediaErasures(discard);
      expect(discard).toEqual([]);
      await alive(key);
    });

    it('override = ключ іншого фото: зняття override лишає файл', async () => {
      const p = await create({ uk: { name: 'Кабель' } });
      const [a, b] = [await upload(p.id), await upload(p.id)];
      const [ia, ib] = [img(a), img(b, { sortOrder: 1 })];
      const s1 = await saveDescription(p.id, p.version, {
        images: { upsert: [ia, { ...ib, overrides: { en: a } }] },
      });
      await saveDescription(p.id, s1.version, {
        images: { upsert: [{ ...ib, overrides: { en: null } }] },
      });
      await alive(a);
    });

    it('override = ключ іншого фото: каскад видалення модифікації з таким override лишає файл', async () => {
      const p = await create({ uk: { name: 'Кабель' } });
      const [mod, a, b] = [
        randomUUID(),
        await upload(p.id),
        await upload(p.id),
      ];
      const s1 = await saveDescription(p.id, p.version, {
        modifications: { upsert: [{ id: mod, texts: { uk: { name: 'M' } } }] },
      });
      await saveDescription(p.id, s1.version, {
        images: {
          upsert: [
            img(a),
            img(b, { modificationId: mod, sortOrder: 1, overrides: { en: a } }),
          ],
        },
      });
      const discard: string[] = [];
      await withActor({ role: 'app_admin' }, (tx) =>
        productModificationsOps.removeIn(tx, [{ id: mod }], discard),
      );
      await completeMediaErasures(discard);
      expect(discard).toEqual([b]);
      await alive(a);
    });

    it('remove модифікації чекає замка кореня товару (серіалізація з командами агрегата)', async () => {
      const p = await create({ uk: { name: 'Кабель' } });
      const mod = randomUUID();
      await saveDescription(p.id, p.version, {
        modifications: { upsert: [{ id: mod, texts: { uk: { name: 'M' } } }] },
      });
      let release!: () => void;
      let locked!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      const held = new Promise<void>((r) => (locked = r));
      // Команда агрегата «в польоті»: тримає FOR UPDATE кореня.
      const holder = withActor({ role: 'app_admin' }, async (tx) => {
        await tx.execute(
          sql`select 1 from public.products where id = ${p.id} for update`,
        );
        locked();
        await gate;
      });
      await held;
      let done = false;
      const removal = withActor({ role: 'app_admin' }, (tx) =>
        productModificationsOps.removeIn(tx, [{ id: mod }], []),
      ).then(() => (done = true));
      await new Promise((r) => setTimeout(r, 400));
      expect(done).toBe(false);
      release();
      await Promise.all([holder, removal]);
      expect(done).toBe(true);
    });

    it('гонка: T2 копіює фото з ключем K у новий рядок, T1 знімає модифікацію з K — T1 чекає замка кореня, файл K живий', async () => {
      const p = await create({ uk: { name: 'Кабель' } });
      const [mod, key] = [randomUUID(), await upload(p.id)];
      const s1 = await saveDescription(p.id, p.version, {
        modifications: { upsert: [{ id: mod, texts: { uk: { name: 'M' } } }] },
      });
      const old = img(key, { modificationId: mod });
      const s2 = await saveDescription(p.id, s1.version, {
        images: { upsert: [old] },
      });
      let release!: () => void;
      let started!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      const open = new Promise<void>((r) => (started = r));
      // T2: справжня команда агрегата в транзакції, яку тримаємо відкритою
      // ПІСЛЯ запису (замок кореня й нове посилання на K вже є).
      const t2 = withActor({ role: 'app_admin' }, async (tx) => {
        const input = productsSaveDescription.input.parse({
          id: p.id,
          expectedVersion: s2.version,
          images: {
            // Лише копія: видалення старого рядка T2 змусило б T1 чекати на
            // рядковий замок каскаду, і тест не відрізняв би замок кореня.
            upsert: [img(key, { sortOrder: 1 })],
          },
        });
        await productsSaveDescription.run(
          {
            subject,
            actor: { role: 'app_admin' },
            db: tx,
            afterCommit: () => undefined,
          } as never,
          input,
        );
        started();
        await gate;
      });
      await open;
      // T1: стирач файлів цього ж власника — remove модифікації з фото K.
      const discard: string[] = [];
      let done = false;
      const t1 = withActor({ role: 'app_admin' }, (tx) =>
        productModificationsOps.removeIn(tx, [{ id: mod }], discard),
      ).then(() => (done = true));
      // T1 справді стоїть на замку (а не просто ще не стартував).
      let waiting = 0;
      for (let i = 0; i < 40 && waiting === 0; i++) {
        await new Promise((r) => setTimeout(r, 100));
        const rows = await db.q(
          `select 1 from pg_stat_activity
            where datname = current_database() and wait_event_type = 'Lock'`,
        );
        waiting = rows.length;
      }
      expect(waiting).toBeGreaterThan(0);
      expect(done).toBe(false);
      release();
      await Promise.all([t2, t1]);
      await completeMediaErasures(discard);
      expect(discard).not.toContain(key);
      await alive(key);
    });

    /** T2: saveDescription у транзакції, яку тримаємо відкритою після запису. */
    const holdSave = async (
      id: string,
      expectedVersion: number,
      body: object,
    ) => {
      let release!: () => void;
      let started!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      const open = new Promise<void>((r) => (started = r));
      const done = withActor({ role: 'app_admin' }, async (tx) => {
        const input = productsSaveDescription.input.parse({
          id,
          expectedVersion,
          ...body,
        });
        await productsSaveDescription.run(
          {
            subject,
            actor: { role: 'app_admin' },
            db: tx,
            afterCommit: () => undefined,
          } as never,
          input,
        );
        started();
        await gate;
      });
      // Якщо T2 впав до `started`, не зависаємо на `open`.
      await Promise.race([open, done]);
      return { release, done };
    };
    const lockWaiters = async () => {
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 100));
        const rows = await db.q(
          `select 1 from pg_stat_activity
            where datname = current_database() and wait_event_type = 'Lock'`,
        );
        if (rows.length > 0) return rows.length;
      }
      return 0;
    };
    const eraseUnreferenced = (pid: string, key: string, out: string[]) =>
      withActor({ role: 'app_admin' }, async (tx) => {
        out.push(
          ...(await eraseMediaRows(tx, [key], {
            entityType: 'product',
            entityId: pid,
          })),
        );
      });

    it('ключ не з before: eraseMediaRows чекає FOR SHARE від saveDescription, після коміту бачить посилання і лишає файл', async () => {
      const p = await create({ uk: { name: 'Кабель' } });
      const key = await upload(p.id);
      const t2 = await holdSave(p.id, p.version, {
        images: { upsert: [img(key)] },
      });
      const erased: string[] = [];
      let finished = false;
      const t1 = eraseUnreferenced(p.id, key, erased).then(
        () => (finished = true),
      );
      expect(await lockWaiters()).toBeGreaterThan(0);
      expect(finished).toBe(false);
      t2.release();
      await Promise.all([t2.done, t1]);
      await completeMediaErasures(erased);
      expect(erased).toEqual([]);
      await alive(key);
    });

    it('ключ не з before: sweep пропускає (SKIP LOCKED) рядок media, який тримає saveDescription, і лишає файл', async () => {
      const p = await create({ uk: { name: 'Кабель' } });
      const key = await upload(p.id);
      await db.q(
        `update public.media set created_at = now() - interval '1 year' where storage_key = $1`,
        [key],
      );
      const t2 = await holdSave(p.id, p.version, {
        images: { upsert: [img(key)] },
      });
      // Sweep не чекає на замок, а обходить заблокований рядок: закінчується
      // ДО коміту T2 і нічого не стирає (без SKIP LOCKED завис би на T2).
      const outcome = await Promise.race([
        sweepUnreferencedMediaOp(),
        new Promise<'blocked'>((r) => setTimeout(() => r('blocked'), 3_000)),
      ]);
      t2.release();
      await t2.done;
      expect(outcome).not.toBe('blocked');
      const swept = outcome as { erased: number };
      expect(swept.erased).toBe(0);
      await alive(key);
    });

    it('зворотний порядок: eraseMediaRows завершився першим — saveDescription отримує 409 media_ref_invalid, посилання на стертий файл немає', async () => {
      const p = await create({ uk: { name: 'Кабель' } });
      const key = await upload(p.id);
      const erased: string[] = [];
      await eraseUnreferenced(p.id, key, erased);
      await completeMediaErasures(erased);
      expect(erased).toEqual([key]);
      const err = await rejects(
        saveDescription(p.id, p.version, { images: { upsert: [img(key)] } }),
      );
      expect(err).toBeInstanceOf(AdminConflictError);
      expect(err).toMatchObject({ kind: 'state' });
      expect(
        await db.q(
          `select 1 from public.product_images where storage_key = $1`,
          [key],
        ),
      ).toHaveLength(0);
    });

    it('старий шлях products.images: заміна масиву не стирає файл, що лишився в product_images', async () => {
      const p = await create({ uk: { name: 'Кабель' } });
      const [k1, k2] = [await upload(p.id), await upload(p.id)];
      await saveDescription(p.id, p.version, {
        images: { upsert: [img(k1), img(k2, { sortOrder: 1 })] },
      });
      const discard: string[] = [];
      await withActor({ role: 'app_admin' }, (tx) =>
        productsOps.updateIn(
          tx,
          [{ id: p.id, patch: { images: [k2] } }],
          discard,
        ),
      );
      await completeMediaErasures(discard);
      expect(discard).toEqual([]);
      await alive(k1);
      await alive(k2);
    });
  });
});
