// М1 Task 11, І11/І12/І14/І17: команди агрегата товару проти живого Postgres.
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  AdminNotFoundError,
  SourceChangedError,
  ValidationError,
  VersionMismatchError,
} from 'simplycms/contracts/domain-errors';
import {
  productsDeleteTranslation,
  productsRemove,
  productsSetPath,
} from 'simplycms/admin-server/impl';
import { sanitizeRichHtml } from 'simplycms/sanitize';
import { sourceFieldHash } from 'simplycms/translations';
import { useAddressingDb } from './fixtures/addressing-db';
import {
  create,
  exec,
  get,
  saveDescription,
  saveTranslation,
} from './fixtures/product-aggregate';

describe('агрегат товару (М1, Task 11)', () => {
  const db = useAddressingDb('simplycms_product_aggregate');
  const row = async (id: string, locale: string) =>
    (
      await db.q(
        `select * from public.product_translations where product_id = $1 and locale = $2`,
        [id, locale],
      )
    )[0];
  const rejects = async (p: Promise<unknown>) =>
    p.then(
      () => null,
      (e: unknown) => e,
    );

  beforeAll(async () => {
    await db.language('en');
    await db.language('de', 'draft');
  });

  const seed = () =>
    create({
      uk: { name: 'Кабель', description: '<p>Опис</p>' },
      en: { name: 'Cable', description: '<p>Desc</p>' },
    });

  it('create без основної мови → validation', async () => {
    const err = await rejects(create({ en: { name: 'Cable' } }));
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).issues[0]?.path).toEqual([
      'texts',
      'uk',
      'name',
    ]);
    expect(await rejects(create({ uk: {} }))).toBeInstanceOf(ValidationError);
  });

  it('create → paths для draft і published мов; slug і назва дзеркалені', async () => {
    const { id, version, paths } = await create({
      uk: { name: 'Кабель HDMI' },
    });
    expect(version).toBe(1);
    expect(paths).toEqual({
      de: 'kabel-hdmi',
      en: 'kabel-hdmi',
      uk: 'kabel-hdmi',
    });
    const [p] = await db.q(
      `select slug, name, version from public.products where id = $1`,
      [id],
    );
    expect(p).toMatchObject({
      slug: 'kabel-hdmi',
      name: 'Кабель HDMI',
      version: 1,
    });
    expect((await get(id)).paths).toEqual(paths);
  });

  it('create: нелатинська назва без пакета й без path → validation на path; явний path працює', async () => {
    const err = await rejects(create({ uk: { name: '東京' } }));
    expect((err as ValidationError).issues).toEqual([
      { path: ['path'], code: 'path_required' },
    ]);
    const ok = await create({ uk: { name: '東京' } }, { path: 'tokyo-item' });
    expect(ok.paths.uk).toBe('tokyo-item');
    expect(
      await rejects(create({ uk: { name: 'X' } }, { path: 'Bad Path' })),
    ).toBeInstanceOf(ValidationError);
  });

  it('saveDescription без en не видаляє рядок en (І11)', async () => {
    const { id, version } = await seed();
    await saveDescription(id, version, { texts: { uk: { name: 'Кабель 2' } } });
    expect((await row(id, 'en'))?.name).toBe('Cable');
  });

  it('сценарій 1: зміна uk.description → en.description outdated, en.name current', async () => {
    const { id, version } = await seed();
    await saveDescription(id, version, {
      texts: { uk: { description: '<p>Новий</p>' } },
    });
    const en = (await get(id)).texts.en!;
    expect(en.fieldStatus).toMatchObject({
      description: 'outdated',
      name: 'current',
    });
    expect(en.status).toBe('outdated');
  });

  it('сценарій 2: uk.name + en.name в одному запиті → en.name current, en.description outdated', async () => {
    const { id, version } = await seed();
    const v2 = (
      await saveDescription(id, version, {
        texts: { uk: { description: '<p>Новий</p>' } },
      })
    ).version;
    await saveDescription(id, v2, {
      texts: { uk: { name: 'Новий кабель' }, en: { name: 'New cable' } },
    });
    const en = (await get(id)).texts.en!;
    expect(en.fieldStatus).toMatchObject({
      name: 'current',
      description: 'outdated',
    });
    expect((await row(id, 'en'))?.source_hashes).toEqual({
      name: sourceFieldHash('Новий кабель'),
      // хеш СТАРОГО джерела: ненадіслане поле зберігає свій хеш (сценарій 2)
      description: sourceFieldHash('<p>Опис</p>'),
    });
  });

  it("null очищує необов'язкове, '' і <p></p> теж; null для name → validation", async () => {
    const { id, version } = await seed();
    const v2 = (
      await saveDescription(id, version, {
        texts: { en: { description: '<p></p>', shortDescription: '' } },
      })
    ).version;
    expect((await row(id, 'en'))?.description).toBeNull();
    await saveDescription(id, v2, { texts: { uk: { description: null } } });
    expect((await get(id)).texts.uk!.description).toBeNull();
    const err = await rejects(
      saveDescription(id, v2 + 1, { texts: { en: { name: null } } }),
    );
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).issues[0]?.path).toEqual([
      'texts',
      'en',
      'name',
    ]);
  });

  it('невідома мова й невідоме поле → validation', async () => {
    const { id, version } = await seed();
    expect(
      await rejects(
        saveDescription(id, version, { texts: { pl: { name: 'x' } } }),
      ),
    ).toBeInstanceOf(ValidationError);
    expect(
      await rejects(
        saveDescription(id, version, { texts: { en: { slug: 'x' } } }),
      ),
    ).toBeInstanceOf(ValidationError);
  });

  it('expectedVersion застаріла → VersionMismatchError з currentVersion (І14)', async () => {
    const { id, version } = await seed();
    await saveDescription(id, version, { base: { sku: 'A' } });
    const err = await rejects(
      saveDescription(id, version, { base: { sku: 'B' } }),
    );
    expect(err).toBeInstanceOf(VersionMismatchError);
    expect((err as VersionMismatchError).currentVersion).toBe(version + 1);
    expect((await get(id)).base.sku).toBe('A');
  });

  it('версія і хеш обидва погані → 412, не 409', async () => {
    const { id, version } = await seed();
    await saveDescription(id, version, { base: { sku: 'A' } });
    const err = await rejects(
      saveTranslation(id, version, 'en', { name: 'X' }, { name: 'не-той-хеш' }),
    );
    expect(err).toBeInstanceOf(VersionMismatchError);
  });

  it('хеш поганий при вірній версії → SourceChangedError з поточними хешами (camelCase)', async () => {
    const { id, version } = await seed();
    const err = await rejects(
      saveTranslation(
        id,
        version,
        'en',
        { description: '<p>D2</p>' },
        { description: 'старий' },
      ),
    );
    expect(err).toBeInstanceOf(SourceChangedError);
    expect((err as SourceChangedError).locale).toBe('en');
    expect((err as SourceChangedError).current).toEqual({
      name: sourceFieldHash('Кабель'),
      description: sourceFieldHash('<p>Опис</p>'),
    });
    expect((await row(id, 'en'))?.description).toBe('<p>Desc</p>');
    expect((await get(id)).version).toBe(version);
  });

  it('saveTranslation з вірними хешами стампує expected і піднімає версію', async () => {
    const { id, version } = await seed();
    const out = await saveTranslation(
      id,
      version,
      'en',
      { description: '<p>D2</p>' },
      { description: sourceFieldHash('<p>Опис</p>') },
    );
    expect(out.version).toBe(version + 1);
    expect((await get(id)).texts.en!.fieldStatus.description).toBe('current');
  });

  it('дві правки перекладу en з тим самим хешем джерела і тією самою версією — друга 412', async () => {
    const { id, version } = await seed();
    const expected = { description: sourceFieldHash('<p>Опис</p>') };
    await saveTranslation(
      id,
      version,
      'en',
      { description: '<p>A</p>' },
      expected,
    );
    const err = await rejects(
      saveTranslation(id, version, 'en', { description: '<p>B</p>' }, expected),
    );
    expect(err).toBeInstanceOf(VersionMismatchError);
    expect((await row(id, 'en'))?.description).toBe('<p>A</p>');
  });

  it('saveTranslation: основна мова → validation', async () => {
    const { id, version } = await seed();
    expect(
      await rejects(saveTranslation(id, version, 'uk', { name: 'X' }, {})),
    ).toBeInstanceOf(ValidationError);
  });

  it('saveDescription з новою назвою не змінює шлях (І17)', async () => {
    const { id, version, paths } = await create({
      uk: { name: 'Перша назва' },
    });
    await saveDescription(id, version, {
      texts: { uk: { name: 'Зовсім інша назва' } },
    });
    expect((await get(id)).paths).toEqual(paths);
    const [p] = await db.q(
      `select slug, name from public.products where id = $1`,
      [id],
    );
    expect(p).toMatchObject({
      slug: 'persha-nazva',
      name: 'Зовсім інша назва',
    });
  });

  it('опис з <script> → хеш = хеш санітизованого', async () => {
    const { id, version } = await create({
      uk: { name: 'Кабель', description: '<p>Опис</p>' },
      en: { name: 'Cable' },
    });
    const dirty = '<p>Текст</p><script>alert(1)</script>';
    const clean = sanitizeRichHtml(dirty, 'content');
    expect(clean).not.toBe(dirty);
    await saveDescription(id, version, {
      texts: { uk: { description: dirty }, en: { description: '<p>Text</p>' } },
    });
    expect((await get(id)).texts.uk!.description).toBe(clean);
    expect((await row(id, 'en'))?.source_hashes).toMatchObject({
      description: sourceFieldHash(clean),
    });
  });

  it('deleteTranslation основної → validation; en видаляється, версія росте', async () => {
    const { id, version } = await seed();
    expect(
      await rejects(
        exec(productsDeleteTranslation, {
          id,
          locale: 'uk',
          expectedVersion: version,
        }),
      ),
    ).toBeInstanceOf(ValidationError);
    const out = await exec(productsDeleteTranslation, {
      id,
      locale: 'en',
      expectedVersion: version,
    });
    expect(out.version).toBe(version + 1);
    expect(await row(id, 'en')).toBeUndefined();
    expect(
      await rejects(
        exec(productsDeleteTranslation, {
          id,
          locale: 'en',
          expectedVersion: version + 1,
        }),
      ),
    ).toBeInstanceOf(AdminNotFoundError);
  });

  it('setPath: версія росте, стара адреса в історії, slug дзеркалить основну мову', async () => {
    const { id, version } = await create({ uk: { name: 'Адреса тест' } });
    const out = await exec(productsSetPath, {
      id,
      locale: 'uk',
      path: 'moya-adresa',
      expectedVersion: version,
    });
    expect(out.version).toBe(version + 1);
    expect((await get(id)).paths.uk).toBe('moya-adresa');
    const [p] = await db.q(`select slug from public.products where id = $1`, [
      id,
    ]);
    expect(p?.slug).toBe('moya-adresa');
    const hist = await db.q(
      `select path from public.url_paths where product_id = $1 and locale = 'uk' and not is_current`,
      [id],
    );
    expect(hist.map((r) => r.path)).toEqual(['adresa-test']);
    expect(
      await rejects(
        exec(productsSetPath, {
          id,
          locale: 'uk',
          path: 'x-y',
          expectedVersion: version,
        }),
      ),
    ).toBeInstanceOf(VersionMismatchError);
  });

  it('remove: версія перевіряється, товар зникає з перекладами й адресами', async () => {
    const { id, version } = await seed();
    expect(
      await rejects(exec(productsRemove, { id, expectedVersion: version + 5 })),
    ).toBeInstanceOf(VersionMismatchError);
    await exec(productsRemove, { id, expectedVersion: version });
    expect(await rejects(get(id))).toBeInstanceOf(AdminNotFoundError);
    expect(
      await db.q(
        `select 1 from public.product_translations where product_id = $1`,
        [id],
      ),
    ).toHaveLength(0);
    expect(
      await db.q(`select 1 from public.url_paths where product_id = $1`, [id]),
    ).toHaveLength(0);
  });

  it('get: неіснуючий товар → AdminNotFoundError; статуси основної мови current', async () => {
    expect(await rejects(get(randomUUID()))).toBeInstanceOf(AdminNotFoundError);
    const { id } = await seed();
    expect((await get(id)).texts.uk).toMatchObject({
      status: 'current',
      fieldStatus: { name: 'current', metaTitle: 'missing' },
    });
  });

  it('сценарій 3: назване, але не надіслане поле лише перевіряється — його хеш не змінюється', async () => {
    const { id, version } = await seed();
    const v2 = (
      await saveDescription(id, version, {
        texts: { uk: { description: '<p>Новий</p>' } },
      })
    ).version;
    const before = (await row(id, 'en'))?.source_hashes as Record<
      string,
      string
    >;
    await saveTranslation(
      id,
      v2,
      'en',
      { name: 'Cable 2' },
      {
        name: sourceFieldHash('Кабель'),
        description: sourceFieldHash('<p>Новий</p>'),
      },
    );
    const after = (await row(id, 'en'))?.source_hashes as Record<
      string,
      string
    >;
    expect(after.description).toBe(before.description);
    const en = (await get(id)).texts.en!;
    expect(en.fieldStatus).toMatchObject({
      name: 'current',
      description: 'outdated',
    });
  });

  it('надіслане поле без хеша в expectedSourceHashes → validation на шляху поля, нічого не записано', async () => {
    const { id, version } = await seed();
    const err = await rejects(
      saveTranslation(id, version, 'en', { description: '<p>D2</p>' }, {}),
    );
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).issues).toEqual([
      { path: ['expectedSourceHashes', 'description'], code: 'invalid_type' },
    ]);
    expect((await row(id, 'en'))?.description).toBe('<p>Desc</p>');
    expect((await get(id)).version).toBe(version);
  });

  it('валідація перед версією (400, не 412): застаріла версія + невалідна мова/адреса/основна мова', async () => {
    const { id, version } = await seed();
    await saveDescription(id, version, { base: { sku: 'A' } });
    const stale = version;
    // Фабрики, а не готові проміси: перший відхилений проміс без обробника,
    // поки тест чекає на попередній, давав б unhandled rejection у vitest.
    const bad = [
      () =>
        exec(productsSetPath, {
          id,
          locale: 'pl',
          path: 'x-y',
          expectedVersion: stale,
        }),
      () =>
        exec(productsSetPath, {
          id,
          locale: 'uk',
          path: 'Bad Path',
          expectedVersion: stale,
        }),
      () =>
        exec(productsDeleteTranslation, {
          id,
          locale: 'uk',
          expectedVersion: stale,
        }),
    ];
    for (const run of bad)
      expect(await rejects(run())).toBeInstanceOf(ValidationError);
  });
});
