// М1 Task 14, І23: проєкція тексту товару = функція джерела після КОЖНОЇ команди.
// Звірка `reconcileProductTexts` після команди мусить давати `mismatched: 0`.
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { copyPathsForLocale } from 'simplycms/addressing';
import { reconcileProductTexts } from 'simplycms/catalog-projection';
import {
  languagesAdd,
  languagesFill,
  languagesSetStatus,
  productsDeleteTranslation,
  productsRemove,
  productsSetPath,
} from 'simplycms/admin-server/impl';
import { completeness } from '../../../src/admin-server/impl/languages/completeness';
import { sourceFieldHash } from 'simplycms/translations';
import { PROJECTION_STEP } from '../../../../../scripts/dev-stand/generate-seed.mjs';
import { pathHelpers, useAddressingDb } from './fixtures/addressing-db';
import {
  create,
  exec,
  get,
  saveDescription,
  saveTranslation,
} from './fixtures/product-aggregate';
import { insertProductGraphAt } from './fixtures/product-graph';

describe('проєкція тексту товару (М1, Task 14)', () => {
  const db = useAddressingDb('simplycms_catalog_projection');
  const { addr } = pathHelpers(db);
  const reconcile = () =>
    db.admin((d) => reconcileProductTexts(d, { limit: 10_000 }));
  const clean = async () =>
    expect(await reconcile()).toEqual({ mismatched: 0, fixed: 0 });
  const proj = async (id: string, locale: string) =>
    (
      await db.q(
        `select * from public.catalog_product_texts where product_id = $1 and locale = $2`,
        [id, locale],
      )
    )[0];
  const version = async (id: string) => (await get(id)).version;
  const setStatus = (code: string, status: string) =>
    exec(languagesSetStatus, { code, status });
  const fillAll = async (code: string) => {
    for (let i = 0; i < 50; i += 1)
      if ((await exec(languagesFill, { code, batch: 2 })).done) return;
    throw new Error('fill не завершився');
  };
  const missingProjection = (code: string) =>
    db.admin((d) => completeness(d, code)).then((c) => c.missingProjection);

  beforeAll(async () => {
    await db.language('en');
    await db.language('de', 'draft');
  });

  const seed = () =>
    create({
      uk: { name: 'Кабель', description: '<p>Опис</p>' },
      en: { name: 'Cable', description: '<p>Desc</p>' },
    });

  it('create: рядок на кожну draft/published мову, fallback і адреса', async () => {
    const { id, paths } = await create({
      uk: { name: 'Шнур', shortDescription: 'Короткий' },
      en: { name: 'Cord' },
    });
    expect(await proj(id, 'uk')).toMatchObject({
      name: 'Шнур',
      short_description: 'Короткий',
      path: paths.uk,
      is_translated: true,
    });
    // en: назва своя, короткий опис — з основної мови (fallback), але переклад неповний.
    expect(await proj(id, 'en')).toMatchObject({
      name: 'Cord',
      short_description: 'Короткий',
      is_translated: false,
    });
    expect(await proj(id, 'de')).toMatchObject({ name: 'Шнур' });
    await clean();
  });

  it('неперекладене en → текст uk, is_translated=false', async () => {
    const { id } = await create({
      uk: { name: 'Лише укр', description: '<p>Д</p>' },
    });
    expect(await proj(id, 'en')).toMatchObject({
      name: 'Лише укр',
      description: '<p>Д</p>',
      is_translated: false,
    });
    await clean();
  });

  it('назва en + опис лише uk → is_translated=false (І33 б)', async () => {
    const { id } = await create({
      uk: { name: 'Кабель', description: '<p>Опис</p>' },
      en: { name: 'Cable' },
    });
    expect(await proj(id, 'en')).toMatchObject({
      name: 'Cable',
      description: '<p>Опис</p>',
      is_translated: false,
    });
    const v = await version(id);
    await saveDescription(id, v, {
      texts: { en: { description: '<p>Desc</p>' } },
    });
    expect(await proj(id, 'en')).toMatchObject({ is_translated: true });
    await clean();
  });

  it('saveDescription: сценарії 1–2 і saveTranslation (сценарій 3) тримають проєкцію', async () => {
    const { id } = await seed();
    // 1: лише джерело — fallback і is_translated УСІХ мов оновлюються.
    await saveDescription(id, await version(id), {
      texts: { uk: { shortDescription: 'Новий короткий' } },
    });
    expect(await proj(id, 'en')).toMatchObject({
      short_description: 'Новий короткий',
      is_translated: false,
    });
    await clean();
    // 2: джерело разом з перекладом.
    await saveDescription(id, await version(id), {
      texts: {
        uk: { name: 'Кабель 2' },
        en: { shortDescription: 'New short' },
      },
    });
    expect(await proj(id, 'en')).toMatchObject({
      short_description: 'New short',
      is_translated: true,
    });
    await clean();
    // 3: переклад однієї мови з хешами джерела.
    await saveTranslation(
      id,
      await version(id),
      'de',
      { name: 'Kabel' },
      { name: sourceFieldHash('Кабель 2') },
    );
    expect(await proj(id, 'de')).toMatchObject({ name: 'Kabel' });
    await clean();
  });

  it('deleteTranslation: рядок лишається з fallback, is_translated=false', async () => {
    const { id } = await seed();
    await exec(productsDeleteTranslation, {
      id,
      locale: 'en',
      expectedVersion: await version(id),
    });
    expect(await proj(id, 'en')).toMatchObject({
      name: 'Кабель',
      is_translated: false,
    });
    await clean();
  });

  it('setPath (П7): новий path у проєкції в тій самій транзакції', async () => {
    const { id } = await seed();
    await exec(productsSetPath, {
      id,
      locale: 'en',
      path: 'cable-new',
      expectedVersion: await version(id),
    });
    expect((await proj(id, 'en'))?.path).toBe('cable-new');
    await clean();
  });

  it('remove: рядки зникають каскадом, звірка чиста', async () => {
    const { id } = await seed();
    await exec(productsRemove, { id, expectedVersion: await version(id) });
    expect(
      await db.q(
        `select 1 from public.catalog_product_texts where product_id = $1`,
        [id],
      ),
    ).toHaveLength(0);
    await clean();
  });

  it('звірка бачить і виправляє відсутні, застарілі й зайві рядки', async () => {
    const { id } = await seed();
    await db.q(
      `update public.catalog_product_texts set name = 'хибне' where product_id = $1 and locale = 'en'`,
      [id],
    );
    await db.q(
      `delete from public.catalog_product_texts where product_id = $1 and locale = 'de'`,
      [id],
    );
    expect(await reconcile()).toEqual({ mismatched: 2, fixed: 2 });
    await clean();
    // Зайві: мова вийшла з draft/published, а її рядки лишились.
    await db.w(
      `update public.languages set status = 'disabled' where code = 'de'`,
    );
    const extra = await reconcile();
    expect(extra.mismatched).toBeGreaterThan(0);
    expect(extra.fixed).toBe(extra.mismatched);
    await db.w(
      `update public.languages set status = 'draft' where code = 'de'`,
    );
    const missing = await reconcile();
    expect(missing.mismatched).toBeGreaterThan(0);
    expect(missing.fixed).toBe(missing.mismatched);
    await clean();
  });

  describe('життєвий цикл мови (П4)', () => {
    const add = (code: string) =>
      exec(languagesAdd, { id: randomUUID(), code, name: code });
    const productCount = async () =>
      Number((await db.q(`select count(*)::int n from public.products`))[0]?.n);

    it('add + fill будує проєкцію; повнота рахує відсутні рядки', async () => {
      const { id } = await seed();
      await add('cs');
      // Адреси є, проєкції ще нема: кожен товар — одна відсутня.
      await db.shared((d) => copyPathsForLocale(d, 'cs', 1000));
      expect(await proj(id, 'cs')).toBeUndefined();
      expect(await missingProjection('cs')).toBe(await productCount());
      await fillAll('cs');
      expect(await proj(id, 'cs')).toMatchObject({
        name: 'Кабель',
        is_translated: false,
      });
      expect(await missingProjection('cs')).toBe(0);
      await clean();
    });

    // Зайвих рядків у мові draft/published не буває: джерело без назви відхиляє тригер
    // джерела (І4), товар без адреси — тригер наявності (І16). Зайві рядки мови, що вийшла
    // з набору, — кейс «звірка бачить і виправляє відсутні, застарілі й зайві» вище.
    it('missingProjection рахує відсутні й застарілі', async () => {
      await seed();
      await seed();
      await add('sk');
      await fillAll('sk');
      expect(await missingProjection('sk')).toBe(0);
      const rows = await db.q(
        `select product_id from public.catalog_product_texts where locale = 'sk' order by product_id limit 3`,
      );
      const [stale, gone] = rows.map((r) => r.product_id);
      await db.q(
        `update public.catalog_product_texts set name = 'хибне' where product_id = $1 and locale = 'sk'`,
        [stale],
      );
      await db.q(
        `delete from public.catalog_product_texts where product_id = $1 and locale = 'sk'`,
        [gone],
      );
      expect(await missingProjection('sk')).toBe(2);
      await reconcile();
      await clean();
    });

    it('disabled мова — рядків немає після fill, а вихід у disabled знімає проєкцію', async () => {
      const { id } = await seed();
      await add('hu');
      await fillAll('hu');
      expect(await proj(id, 'hu')).toBeDefined();
      await setStatus('hu', 'disabled');
      const rows = () =>
        db.q(`select 1 from public.catalog_product_texts where locale = 'hu'`);
      expect(await rows()).toHaveLength(0);
      await fillAll('hu');
      expect(await rows()).toHaveLength(0);
      expect(await missingProjection('hu')).toBe(0);
      await clean();
    });

    it('disabled → published дозбирає проєкцію товарів, створених за час вимкнення', async () => {
      await add('lt');
      await fillAll('lt');
      await setStatus('lt', 'disabled');
      const { id } = await seed();
      await fillAll('lt');
      expect(await proj(id, 'lt')).toBeUndefined();
      await setStatus('lt', 'published');
      expect(await proj(id, 'lt')).toMatchObject({ name: 'Кабель' });
      expect(await missingProjection('lt')).toBe(0);
      await clean();
    });

    it('товар без поточної адреси в мові не має рядка (П3), після fill має', async () => {
      await add('ro');
      await fillAll('ro');
      await setStatus('ro', 'disabled');
      const { id } = await seed();
      await setStatus('ro', 'draft');
      expect(await proj(id, 'ro')).toBeUndefined();
      const c = await db.admin((d) => completeness(d, 'ro'));
      expect(c.missingPaths).toBe(1);
      await fillAll('ro');
      expect(await proj(id, 'ro')).toBeDefined();
      await clean();
    });
  });

  it('крок проєкції сіду стенда будує рядки, еквівалентні командам', async () => {
    const { id } = await seed();
    // Історична адреса не повинна потрапити в проєкцію: крок бере лише `is_current`.
    await addr('uk', `stara-adresa-${id}`, id, false);
    await db.q(`delete from public.catalog_product_texts`);
    await db.q(PROJECTION_STEP);
    expect((await proj(id, 'uk'))?.path).not.toContain('stara-adresa');
    await clean();
  });

  it('фікстура insertProductGraph доведена до стану команд: звірка 0 (П6)', async () => {
    const id = randomUUID();
    await insertProductGraphAt(db.url(), {
      id,
      slug: 'fixture-prod',
      name: 'Фікстура',
      texts: { description: '<p>Опис</p>' },
      translations: { en: { name: 'Fixture' } },
    });
    expect(await proj(id, 'en')).toMatchObject({
      name: 'Fixture',
      description: '<p>Опис</p>',
      path: 'fixture-prod',
      is_translated: false,
    });
    expect(await proj(id, 'uk')).toMatchObject({ is_translated: true });
    await clean();
  });
});
