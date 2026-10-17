// М1 Task 14, фікс-раунд 5: fill (KEY SHARE, не чекає команду) і команда, що пише ту саму
// поточну адресу/токен у тій самій новій мові. Fill пропускає рядок, якщо поточний уже є
// (`ON CONFLICT` на частковий UNIQUE поточного запису); команда, що програла, — 409
// «паралельна зміна, повторіть» (`concurrent_change`), а не `path_taken`/`slug_taken`.
// Конфлікт самого шляху (`url_paths_locale_path_key`) fill не ковтає: 409 і повтор.
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { copyPathsForLocale } from 'simplycms/addressing';
import {
  languagesAdd,
  languagesFill,
  productsSetModificationToken,
  productsSetPath,
} from 'simplycms/admin-server/impl';
import { useAddressingDb } from './fixtures/addressing-db';
import { latchRace, outcome } from './fixtures/latch-race';
import { insertModificationAt } from './fixtures/product-graph';
import { create, exec, get } from './fixtures/product-aggregate';

describe('fill <-> команда в новій мові (Task 14, раунд 5)', () => {
  const db = useAddressingDb('simplycms_languages_fill_collisions');
  const add = (code: string) =>
    exec(languagesAdd, { id: randomUUID(), code, name: code });
  const fillAll = async (code: string) => {
    for (let i = 0; i < 50; i += 1)
      if ((await exec(languagesFill, { code })).done) return;
    throw new Error('fill не завершився');
  };
  const setPath = (id: string, locale: string, path: string) => async () =>
    exec(productsSetPath, {
      id,
      locale,
      path,
      expectedVersion: (await get(id)).version,
    });
  const setToken =
    (productId: string, modificationId: string, locale: string, slug: string) =>
    async () =>
      exec(productsSetModificationToken, {
        modificationId,
        locale,
        slug,
        expectedVersion: (await get(productId)).version,
      });
  const currentPath = async (id: string, locale: string) =>
    (
      await db.q(
        `select path from public.url_paths where product_id = $1 and locale = $2 and is_current`,
        [id, locale],
      )
    ).map((r) => r.path);
  const currentToken = async (id: string, locale: string) =>
    (
      await db.q(
        `select slug from public.slug_tokens where modification_id = $1 and locale = $2 and is_current`,
        [id, locale],
      )
    ).map((r) => r.slug);
  const withMod = async (name: string) => {
    const { id } = await create({ uk: { name } });
    const mod = randomUUID();
    await insertModificationAt(db.url(), id, {
      id: mod,
      slug: `m-${mod.slice(0, 8)}`,
      name: 'M',
    });
    return { id, mod };
  };
  const twoSorted = async (name: string) =>
    (
      await Promise.all([
        create({ uk: { name: `${name} 1` } }),
        create({ uk: { name: `${name} 2` } }),
      ])
    )
      .map((p) => p.id)
      .sort() as [string, string];

  it('команда комітить першою: fill пропускає поточну адресу команди, ok/ok', async () => {
    const [q, p] = await twoSorted('Адреса H1');
    await add('sk');
    const out = await latchRace(
      db,
      // fill застрягає на KEY SHARE меншого товару, прочитавши кандидатів (p без адреси sk)
      `select 1 from public.products where id = '${q}' for update`,
      () => fillAll('sk'),
      setPath(p, 'sk', 'h1-explicit'),
      // Передумова кейсу: команда комітить повз застряглий fill, тож мусить ЗАВЕРШИТИСЬ до відпускання T0.
      { second: 'settles' },
    );
    expect(out).toEqual(['ok', 'ok']);
    expect(await currentPath(p, 'sk')).toEqual(['h1-explicit']);
  });

  it('fill комітить першим: команда отримує 409 «паралельна зміна», повтор — ok', async () => {
    const { mod: qa } = await withMod('Адреса H2 q');
    const { id: p } = await create({ uk: { name: 'Адреса H2 p' } });
    await add('sl');
    const out = await latchRace(
      db,
      // fill вставив адреси (зокрема p) і застряг на токенах модифікації q
      `select 1 from public.product_modifications where id = '${qa}' for update`,
      () => fillAll('sl'),
      setPath(p, 'sl', 'h2-explicit'),
    );
    expect(out).toEqual(['ok', 'state:concurrent_change']);
    expect(await outcome(setPath(p, 'sl', 'h2-explicit')())).toBe('ok');
    expect(await currentPath(p, 'sl')).toEqual(['h2-explicit']);
  });

  it('токен: команда першою — fill пропускає; ok/ok', async () => {
    const [x, y] = [await withMod('Токен T1 x'), await withMod('Токен T1 y')];
    await add('sr');
    await db.shared((d) => copyPathsForLocale(d, 'sr', 1000));
    const [lo, hi] = [x, y].sort((u, v) => (u.id < v.id ? -1 : 1)) as [
      typeof x,
      typeof x,
    ];
    const out = await latchRace(
      db,
      `select 1 from public.products where id = '${lo.id}' for update`,
      () => fillAll('sr'),
      setToken(hi.id, hi.mod, 'sr', 'explicit-t'),
      // Те саме: команда мусить завершитись повз застряглий fill.
      { second: 'settles' },
    );
    expect(out).toEqual(['ok', 'ok']);
    expect(await currentToken(hi.mod, 'sr')).toEqual(['explicit-t']);
  });

  it('токен: fill першим — команда отримує 409 «паралельна зміна», повтор — ok', async () => {
    const pm = await withMod('Токен T2 p');
    const q = await create({ uk: { name: 'Токен T2 q' } });
    await add('bs');
    await db.shared((d) => copyPathsForLocale(d, 'bs', 1000));
    // fill вставив токени pm і застряг на проєкції q (адреси є, проєкції bs ще немає)
    const out = await latchRace(
      db,
      `select 1 from public.products where id = '${q.id}' for update`,
      () => fillAll('bs'),
      setToken(pm.id, pm.mod, 'bs', 'explicit-t'),
    );
    expect(out).toEqual(['ok', 'state:concurrent_change']);
    expect(await outcome(setToken(pm.id, pm.mod, 'bs', 'explicit-t')())).toBe(
      'ok',
    );
  });

  it('колізія шляху з командою іншого товару: fill — 409 unique, наступний прохід — ok', async () => {
    const p = await create({ uk: { name: 'Base Two' } });
    await add('mk');
    const r = await create({ uk: { name: 'Other Two' } });
    const [target] = await currentPath(p.id, 'uk');
    const out = await latchRace(
      db,
      // команда r вставила адресу target у mk і застрягла в refresh проєкції
      `select 1 from public.catalog_product_texts where product_id = '${r.id}' and locale = 'mk' for update`,
      setPath(r.id, 'mk', String(target)),
      () => exec(languagesFill, { code: 'mk' }),
    );
    expect(out).toEqual(['ok', 'unique:url_paths_locale_path_key']);
    await fillAll('mk');
    expect(await currentPath(p.id, 'mk')).toEqual([`${String(target)}-2`]);
  });
});
