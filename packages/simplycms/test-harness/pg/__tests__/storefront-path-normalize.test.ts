// М1 Task 15 (І20, І33, І37; Review Focus 5) проти живого Postgres: нормалізація
// адреси за РЕАЛЬНИМ реєстром (`url_paths`, `slug_tokens`) і сторінка товару з проєкції.
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  productsRemove,
  productsSetModificationToken,
  productsSetPath,
} from 'simplycms/admin-server/impl';
import {
  loadProduct,
  loadSitemapData,
  lookupProductAddress,
  withStorefrontDb,
} from 'simplycms/storefront/loaders';
import { renderSitemapXml } from 'simplycms/storefront/seo';
import { normalizeStorefrontRequest } from '../../../src/storefront-routes/seo/normalize';
import { withViewerPricesDb } from '../../../src/storefront/loaders/viewer-prices-db';
import { defaultParseSearch } from '@tanstack/react-router';
import { entitySearch } from '../../../src/storefront-routes/pages/entity-route';
import { useAddressingDb } from './fixtures/addressing-db';
import { create, exec, saveDescription } from './fixtures/product-aggregate';
import { insertValueAt } from './fixtures/product-graph';

const SET = {
  primary: 'uk',
  published: ['uk', 'en'],
  known: ['uk', 'en', 'de'],
};

describe('адреса товару: реєстр, нормалізація і сторінка (Task 15)', () => {
  const db = useAddressingDb('simplycms_storefront_path');
  const run = (path: string) =>
    normalizeStorefrontRequest(
      new URL(path, 'http://localhost'),
      SET,
      lookupProductAddress,
    );
  const location = async (path: string) =>
    (await run(path))?.headers.get('location');
  const page = (locale: string, path: string) =>
    withViewerPricesDb(null, (tx, v) => loadProduct(tx, { locale, path }, v));
  const version = async (id: string) =>
    (await db.q(`select version from public.products where id = $1`, [id]))[0]!
      .version as number;
  const setPath = async (id: string, locale: string, path: string) =>
    exec(productsSetPath, {
      id,
      locale,
      path,
      expectedVersion: await version(id),
    });

  beforeAll(async () => {
    await db.language('en');
    await db.language('de', 'draft');
  });

  const translated = () =>
    create({
      uk: { name: 'Кабель', description: '<p>Опис</p>' },
      en: { name: 'Cable', description: '<p>Desc</p>' },
    });

  it('історична адреса + мова + слеш + utm → ОДИН 301 (І20)', async () => {
    const { id, paths } = await translated();
    await setPath(id, 'uk', 'novyi-kabel');
    await setPath(id, 'en', 'new-cable');

    expect(await location(`/uk/${paths.uk}?utm=1`)).toBe('/novyi-kabel?utm=1');
    expect(await location(`/${paths.uk}`)).toBe('/novyi-kabel');
    expect(await location(`/en/${paths.en}/`)).toBe('/en/new-cable');
    // Поточні адреси — без редіректу, сторінка відкривається.
    expect(await run('/novyi-kabel')).toBeNull();
    expect(await run('/en/new-cable')).toBeNull();
  });

  it('історичний токен ?mod= → ОДИН 301 на поточний; разом з історичною адресою — теж один', async () => {
    const { id, version: v } = await translated();
    const mod = randomUUID();
    const s = await saveDescription(id, v, {
      modifications: {
        upsert: [{ id: mod, texts: { uk: { name: 'Червоний' } } }],
      },
    });
    const [{ slug: oldToken }] = (await db.q(
      `select slug from public.slug_tokens where modification_id = $1 and locale = 'uk'`,
      [mod],
    )) as Array<{ slug: string }>;
    await exec(productsSetModificationToken, {
      modificationId: mod,
      locale: 'uk',
      slug: 'red-uk',
      expectedVersion: s.version,
    });
    const [{ path }] = (await db.q(
      `select path from public.url_paths where product_id = $1 and locale = 'uk'`,
      [id],
    )) as Array<{ path: string }>;
    await setPath(id, 'uk', 'kabel-chervonyi');

    expect(await location(`/kabel-chervonyi?mod=${oldToken}`)).toBe(
      '/kabel-chervonyi?mod=red-uk',
    );
    expect(await location(`/uk/${path}/?mod=${oldToken}&utm=1`)).toBe(
      '/kabel-chervonyi?mod=red-uk&utm=1',
    );
    // Поточний і невідомий токени не чіпаємо.
    expect(await run('/kabel-chervonyi?mod=red-uk')).toBeNull();
    expect(await run('/kabel-chervonyi?mod=nope')).toBeNull();
  });

  it('токен ?mod=, який роутер читає як не-рядок (123): резолв у БД і канонічна лапкована форма', async () => {
    const { id, version: v, paths } = await translated();
    const mod = randomUUID();
    const s = await saveDescription(id, v, {
      modifications: {
        upsert: [{ id: mod, texts: { uk: { name: 'Розмір' } } }],
      },
    });
    const [{ slug: oldToken }] = (await db.q(
      `select slug from public.slug_tokens where modification_id = $1 and locale = 'uk'`,
      [mod],
    )) as Array<{ slug: string }>;
    await exec(productsSetModificationToken, {
      modificationId: mod,
      locale: 'uk',
      slug: '123',
      expectedVersion: s.version,
    });
    expect(await location(`/${paths.uk}?mod=${oldToken}`)).toBe(
      `/${paths.uk}?mod=%22123%22`,
    );
    // Поточний токен, набраний як число, теж зводиться до канонічної форми роутера.
    expect(await location(`/${paths.uk}?mod=123`)).toBe(
      `/${paths.uk}?mod=%22123%22`,
    );
    expect(await run(`/${paths.uk}?mod=%22123%22`)).toBeNull();
  });

  it('токен 1e5 (з назви «1E5»): ?mod=1e5 → один 301 на канонічну форму ТОГО САМОГО токена, сторінка з цією модифікацією', async () => {
    const { id, version: v, paths } = await translated();
    const mod = randomUUID();
    await saveDescription(id, v, {
      modifications: { upsert: [{ id: mod, texts: { uk: { name: '1E5' } } }] },
    });
    const [{ slug }] = (await db.q(
      `select slug from public.slug_tokens where modification_id = $1 and locale = 'uk'`,
      [mod],
    )) as Array<{ slug: string }>;
    expect(slug).toBe('1e5');
    const res = await run(`/${paths.uk}?mod=1e5`);
    expect(res?.status).toBe(301);
    // Не `%22100000%22`: роутер розібрав би 1e5 як число, токен береться з сирого query.
    expect(res?.headers.get('location')).toBe(`/${paths.uk}?mod=%221e5%22`);
    expect(await run(`/${paths.uk}?mod=%221e5%22`)).toBeNull();
    const shown = await page('uk', paths.uk!);
    expect(shown?.product_modifications.find((m) => m.id === mod)?.slug).toBe(
      '1e5',
    );
    expect(entitySearch(defaultParseSearch('?mod=%221e5%22'))).toEqual({
      mod: '1e5',
    });
  });

  it('видалений товар: історії немає → нормалізація мовчить, сторінка null (404)', async () => {
    const { id, paths } = await translated();
    await setPath(id, 'uk', 'to-be-removed');
    expect(await location(`/${paths.uk}`)).toBe('/to-be-removed');
    await exec(productsRemove, { id, expectedVersion: await version(id) });

    expect(await run(`/${paths.uk}`)).toBeNull();
    expect(await run('/to-be-removed')).toBeNull();
    expect(await page('uk', paths.uk)).toBeNull();
    expect(await page('uk', 'to-be-removed')).toBeNull();
  });

  it('неперекладене en: текст основної мови, noindex, canonical на основну, без hreflang (І33, І37)', async () => {
    const { paths } = await create({
      uk: { name: 'Лише укр', description: '<p>Опис укр</p>' },
    });
    const en = await page('en', paths.en!);
    expect(en).toMatchObject({
      name: 'Лише укр',
      slug: paths.en,
      page: {
        locale: 'en',
        primary: 'uk',
        isTranslated: false,
        fallbackFields: ['name', 'description'],
        seo: {
          indexable: false,
          robots: 'noindex, follow',
          canonical: `/${paths.uk}`,
          hreflang: [],
        },
      },
    });
  });

  it('частковий переклад (лише назва) — НЕ перекладено: noindex, своя назва, опис з fallback', async () => {
    const { paths } = await create({
      uk: { name: 'Кабель', description: '<p>Опис укр</p>' },
      en: { name: 'Cable' },
    });
    const en = await page('en', paths.en!);
    expect(en?.name).toBe('Cable');
    expect(en?.page).toMatchObject({
      isTranslated: false,
      // Назва своя, `lang` на ній не потрібен; опис — з основної мови.
      fallbackFields: ['description'],
      seo: { indexable: false, robots: 'noindex, follow' },
    });
  });

  it('переклад буквально рівний основній мові — НЕ fallback; відсутній переклад поля — fallback (І37)', async () => {
    const { id, paths } = await create({
      uk: { name: 'iPhone 15', description: '<p>Опис</p>' },
      en: { name: 'iPhone 15' },
    });
    const en = await page('en', paths.en!);
    // Назва перекладена буквально так само: lang основної мови на ній був би хибним.
    expect(en?.page.fallbackFields).toEqual(['description']);
    expect(
      (
        await db.q(
          `select fallback_fields from public.catalog_product_texts where product_id = $1 and locale = 'en'`,
          [id],
        )
      )[0],
    ).toEqual({ fallback_fields: ['description'] });
    expect((await page('uk', paths.uk!))?.page.fallbackFields).toEqual([]);
  });

  it('перекладене en: self-canonical, hreflang uk/en/x-default, своя назва, без fallback-полів', async () => {
    const { paths } = await translated();
    const en = await page('en', paths.en!);
    expect(en?.name).toBe('Cable');
    expect(en?.page).toMatchObject({
      isTranslated: true,
      fallbackFields: [],
      seo: {
        indexable: true,
        canonical: `/en/${paths.en}`,
        hreflang: [
          { hrefLang: 'uk', href: `/${paths.uk}` },
          { hrefLang: 'en', href: `/en/${paths.en}` },
          { hrefLang: 'x-default', href: `/${paths.uk}` },
        ],
      },
    });
    const uk = await page('uk', paths.uk!);
    expect(uk?.page.seo.hreflang).toEqual(en?.page.seo.hreflang);
  });

  it('чернетка мови і неактивний товар недосяжні; шлях іншої мови — теж', async () => {
    const { id, paths } = await translated();
    expect(await page('de', paths.uk!)).toBeNull();
    expect(await page('en', 'нема')).toBeNull();
    await db.q(`update public.products set is_active = false where id = $1`, [
      id,
    ]);
    expect(await page('uk', paths.uk!)).toBeNull();
  });

  it('історична адреса неактивного товару / чернетки мови — без 301 (не розкриває поточну адресу)', async () => {
    const { id, paths } = await translated();
    await setPath(id, 'uk', 'visible-now');
    expect(await location(`/${paths.uk}`)).toBe('/visible-now');
    await db.q(`update public.products set is_active = false where id = $1`, [
      id,
    ]);
    // Сторінка за поточною адресою — 404, тож 301 на неї був би лише витоком slug-а.
    expect(await run(`/${paths.uk}`)).toBeNull();
    expect(await page('uk', 'visible-now')).toBeNull();
    // Те саме для мови, що не `published`: історія в `de` (draft) не редіректить.
    const other = await translated();
    await setPath(other.id, 'de', 'de-new');
    expect(
      await lookupProductAddress('de', other.paths.de ?? other.paths.uk!, null),
    ).toBeNull();
  });

  it('модифікація: токен ?mod=, назва і ознака fallback — мовою сторінки (withFallback)', async () => {
    const { id, version: v, paths } = await translated();
    const [mod, noEn, same] = [randomUUID(), randomUUID(), randomUUID()];
    const s = await saveDescription(id, v, {
      modifications: {
        upsert: [
          {
            id: mod,
            texts: { uk: { name: 'Червоний' }, en: { name: 'Red' } },
          },
          { id: noEn, texts: { uk: { name: 'Чорний' } } },
          { id: same, texts: { uk: { name: 'XL' }, en: { name: 'XL' } } },
        ],
      },
    });
    await exec(productsSetModificationToken, {
      modificationId: mod,
      locale: 'en',
      slug: 'red',
      expectedVersion: s.version,
    });
    const uk = await page('uk', paths.uk!);
    const en = await page('en', paths.en!);
    const byId = (p: typeof en, mid: string) =>
      p?.product_modifications.find((m) => m.id === mid);
    expect(byId(en, mod)).toMatchObject({
      name: 'Red',
      slug: 'red',
      name_lang: null,
    });
    // Немає англійської назви → з основної мови, з її lang (І37).
    expect(byId(en, noEn)).toMatchObject({ name: 'Чорний', name_lang: 'uk' });
    // Переклад буквально рівний основній назві — НЕ fallback.
    expect(byId(en, same)).toMatchObject({ name: 'XL', name_lang: null });
    expect(byId(uk, mod)?.name).toBe('Червоний');
    expect(byId(uk, mod)?.slug).not.toBe('red');
    expect(byId(uk, noEn)?.name_lang).toBeNull();
  });

  it('значення властивостей — за типом: текст з перекладів (fallback), булеве й колір з власних колонок', async () => {
    const { id, paths } = await translated();
    const prop = async (type: string) => {
      const pid = randomUUID();
      await db.q(
        `insert into public.section_properties (id, name, slug, property_type)
         values ($1, $2, $3, $4::property_type)`,
        [pid, `п-${type}`, `p-${type}-${pid.slice(0, 8)}`, type],
      );
      return pid;
    };
    const [text, bool, color, onlyUk] = [
      await prop('text'),
      await prop('boolean'),
      await prop('color'),
      await prop('text'),
    ];
    const owner = { kind: 'product', id } as const;
    await insertValueAt(db.url(), owner, {
      id: randomUUID(),
      propertyId: text,
      kind: 'text',
      text: { uk: 'Так', en: 'Yes' },
    });
    await insertValueAt(db.url(), owner, {
      id: randomUUID(),
      propertyId: bool,
      kind: 'boolean',
      bool: true,
    });
    await insertValueAt(db.url(), owner, {
      id: randomUUID(),
      propertyId: color,
      kind: 'color',
      color: '#ff0000',
    });
    await insertValueAt(db.url(), owner, {
      id: randomUUID(),
      propertyId: onlyUk,
      kind: 'text',
      text: { uk: 'Лише укр' },
    });

    const values = async (locale: string, path: string) => {
      const p = await page(locale, path);
      return Object.fromEntries(
        (p?.product_property_values ?? []).map((v) => [v.property_id, v.value]),
      );
    };
    const langs = async (locale: string, path: string) => {
      const p = await page(locale, path);
      return Object.fromEntries(
        (p?.product_property_values ?? []).map((v) => [
          v.property_id,
          v.value_lang,
        ]),
      );
    };
    expect(await values('en', paths.en!)).toEqual({
      [text]: 'Yes',
      [bool]: 'true',
      [color]: '#ff0000',
      [onlyUk]: 'Лише укр', // fallback на основну мову
    });
    expect((await values('uk', paths.uk!))[text]).toBe('Так');
    // Ознака fallback — з даних: лише текст без англійського перекладу несе `lang` основної.
    expect((await langs('en', paths.en!))[text]).toBeNull();
    expect((await langs('en', paths.en!))[onlyUk]).toBe('uk');
  });

  it('sitemap: неперекладена версія поза ним, перекладена — з alternates', async () => {
    const full = await translated();
    const partial = await create({ uk: { name: 'Без перекладу' } });
    const xml = renderSitemapXml(
      await withStorefrontDb((tx) => loadSitemapData(tx)),
      'https://shop.test',
    );
    expect(xml).toContain(`<loc>https://shop.test/en/${full.paths.en}</loc>`);
    expect(xml).toContain(
      `hreflang="x-default" href="https://shop.test/${full.paths.uk}"`,
    );
    expect(xml).toContain(`<loc>https://shop.test/${partial.paths.uk}</loc>`);
    expect(xml).not.toContain(`/en/${partial.paths.en}`);
  });
});
