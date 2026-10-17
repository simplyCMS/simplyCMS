// М1 Task 14, фікс-раунди 4–5: порядок замків агрегата (`lock-order.ts`, пункти (3)–(5)).
// Кожен кейс — два з'єднання і засувка T0, що розтягує вікно між двома рядковими
// замками одного з учасників до керованого; очікування — обидві операції ok, звірка 0.
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { copyPathsForLocale } from 'simplycms/addressing';
import { reconcileProductTexts } from 'simplycms/catalog-projection';
import {
  languagesAdd,
  languagesFill,
  productsRemove,
  sectionsOps,
} from 'simplycms/admin-server/impl';
import { useAddressingDb } from './fixtures/addressing-db';
import { hold, sleep, until } from './fixtures/lock-holders';
import { insertModificationAt } from './fixtures/product-graph';
import {
  create,
  exec,
  get,
  saveDescription,
} from './fixtures/product-aggregate';

describe('порядок замків агрегата: корінь -> модифікації, KEY SHARE у fill (Task 14, раунд 4)', () => {
  const db = useAddressingDb('simplycms_catalog_projection_order');
  const add = (code: string) =>
    exec(languagesAdd, { id: randomUUID(), code, name: code });
  const fillAll = async (code: string) => {
    for (let i = 0; i < 50; i += 1)
      if ((await exec(languagesFill, { code, batch: 2 })).done) return;
    throw new Error('fill не завершився');
  };
  const settled = (p: Promise<unknown>) =>
    p.then(
      () => 'ok',
      (e: unknown) =>
        (e as { cause?: { code?: string } }).cause?.code ?? String(e),
    );
  const clean = async () =>
    expect(
      await db.admin((d) => reconcileProductTexts(d, { limit: 1000 })),
    ).toEqual({ mismatched: 0, fixed: 0 });
  /** T0 тримає `take` до `release`; далі A, пауза, B, пауза, відпускаємо T0. */
  const race = async (
    take: string,
    first: () => Promise<unknown>,
    second: () => Promise<unknown>,
  ) => {
    const t0 = hold(db, (d) => d.execute(sql.raw(take)));
    await until('T0 тримає засувку', t0.acquired);
    const a = first();
    await sleep(400);
    const b = second();
    await sleep(400);
    t0.release();
    const out = await Promise.all([settled(a), settled(b)]);
    await t0.done;
    return out;
  };

  it('fill <-> видалення розділу з двома товарами (heap не в порядку id): ok/ok, звірка 0', async () => {
    const [a, b] = (
      await Promise.all([
        create({ uk: { name: 'Розділ A' } }),
        create({ uk: { name: 'Розділ B' } }),
      ])
    )
      .map((p) => p.id)
      .sort();
    const section = randomUUID();
    await db.q(
      `insert into public.sections (id, slug, name) values ($1, $2, 'Розділ')`,
      [section, `s-${section}`],
    );
    // Не-HOT оновлення (індексована колонка): b, потім a — каскад SET NULL іде b -> a.
    for (const id of [b, a])
      await db.q(`update public.products set section_id = $1 where id = $2`, [
        section,
        id,
      ]);
    await add('lv');
    const out = await race(
      // T0 тримає SHARE на a: каскад розділу бере b (NO KEY UPDATE) і чекає на a.
      `select 1 from public.products where id = '${a}' for share`,
      () => db.admin((d) => sectionsOps.removeIn(d, [{ id: section }], [])),
      () => fillAll('lv'),
    );
    expect(out).toEqual(['ok', 'ok']);
    await clean();
  });

  /**
   * Товар з двома модифікаціями: id a < b, slug навпаки (fill копіює токени b -> a) і
   * відгуком (засувка видалення). `heapFirst` — яку модифікацію вставити першою: при
   * `'b'` фізичний порядок (seq scan, DELETE без явного порядку) протилежний id.
   */
  const productWithMods = async (name: string, heapFirst: 'a' | 'b' = 'a') => {
    const { id } = await create({ uk: { name } });
    const [a, b] = [randomUUID(), randomUUID()].sort() as [string, string];
    const ins = {
      a: () =>
        insertModificationAt(db.url(), id, { id: a, slug: 'zz', name: 'A' }),
      b: () =>
        insertModificationAt(db.url(), id, { id: b, slug: 'aa', name: 'B' }),
    };
    for (const k of heapFirst === 'a'
      ? (['a', 'b'] as const)
      : (['b', 'a'] as const))
      await ins[k]();
    const review = randomUUID();
    await db.q(
      `insert into public.product_reviews (id, product_id, rating) values ($1, $2, 5)`,
      [review, id],
    );
    return { id, a, b, review };
  };
  const removeProduct = (id: string) => async () =>
    exec(productsRemove, { id, expectedVersion: (await get(id)).version });

  it('products.remove <-> fill (адреса в мові вже є, бракує токенів і проєкції): ok/ok', async () => {
    const { id, review } = await productWithMods('Видалення P-M');
    await add('et');
    // Адреса мови вже є: fill бере товар лише на етапах токенів і проєкції — корінь
    // мусить іти раніше за модифікації в КОЖНОМУ кроці (порядок, пункт (5)).
    await db.shared((d) => copyPathsForLocale(d, 'et', 1000));
    const out = await race(
      // T0 тримає відгук: видалення тримає корінь FOR UPDATE і чекає на відгук (знімок
      // каскадних медіа), ще не взявши модифікацій.
      `select 1 from public.product_reviews where id = '${review}' for key share`,
      removeProduct(id),
      () => fillAll('et'),
    );
    expect(out).toEqual(['ok', 'ok']);
    await clean();
  });

  it('products.remove <-> fill (засувка на більшій модифікації): ok/ok', async () => {
    const { id, b } = await productWithMods('Видалення C2');
    await add('ga');
    await db.shared((d) => copyPathsForLocale(d, 'ga', 1000));
    const out = await race(
      // Видалення тримає корінь і модифікацію a, чекає b; fill має взяти KEY SHARE кореня
      // ДО a — лише FOR UPDATE кореня з боку видалення (пункт (3)) змушує його чекати.
      `select 1 from public.product_modifications where id = '${b}' for key share`,
      removeProduct(id),
      () => fillAll('ga'),
    );
    expect(out).toEqual(['ok', 'ok']);
    await clean();
  });

  it('fill <-> saveDescription, що видаляє дві модифікації (heap b->a, засувка на меншому id): ok/ok', async () => {
    const { id, a, b } = await productWithMods('Видалення C4', 'b');
    await add('fi');
    const out = await race(
      // T0 тримає KEY SHARE на a: видаляч, що йде за id, чекає на a, нічого не тримаючи;
      // без явного FOR UPDATE за id DELETE пішов би фізичним порядком b -> a.
      `select 1 from public.product_modifications where id = '${a}' for key share`,
      async () =>
        saveDescription(id, (await get(id)).version, {
          modifications: { remove: [a, b] },
        }),
      () => fillAll('fi'),
    );
    expect(out).toEqual(['ok', 'ok']);
    await clean();
  });
});
