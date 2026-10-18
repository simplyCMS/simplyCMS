// М1 Task 14, фікс-раунд 1 (I-1): команда бере спільний `languages-set` ДО кореня, тож
// порядок «languages-set -> корінь» проти «languages-set -> FK на рядок товару» у
// setStatus/fill не дає 40P01 (цикл неможливий за побудовою).
// Команда тут бере СПРАВЖНІЙ `lockProduct`, а refresh викликає після паузи.
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { copyPathsForLocale } from 'simplycms/addressing';
import {
  reconcileProductTexts,
  refreshProductTexts,
} from 'simplycms/catalog-projection';
import {
  languagesAdd,
  languagesFill,
  languagesSetStatus,
  productsRemove,
} from 'simplycms/admin-server/impl';
import { lockProduct } from '../../../src/admin-server/impl/products/aggregate/load';
import { useAddressingDb } from './fixtures/addressing-db';
import { hold, until, waitForBlockedTree } from './fixtures/lock-holders';
import { insertModificationAt } from './fixtures/product-graph';
import {
  create,
  exec,
  get,
  saveDescription,
} from './fixtures/product-aggregate';

// Кейс, що не дочекався черги, відпускає тримача: інакше його замок висів би до кінця файла.
const RELEASE = { releaseOnFail: true } as const;

describe('замки команди товару проти setStatus і fill (М1, Task 14, I-1)', () => {
  const db = useAddressingDb('simplycms_catalog_projection_locks');
  const add = (code: string) =>
    exec(languagesAdd, { id: randomUUID(), code, name: code });
  const fillAll = async (code: string) => {
    for (let i = 0; i < 50; i += 1)
      if ((await exec(languagesFill, { code, batch: 2 })).done) return;
    throw new Error('fill не завершився');
  };

  /** Команда: lockProduct -> утримання до `proceed` -> refresh, як текстова команда агрегата. */
  const command = (id: string) => {
    const h = hold(
      db,
      (d) => lockProduct(d, id),
      (d) => refreshProductTexts(d, [id]),
    );
    return { ...h, locked: h.acquired, proceed: h.release };
  };
  const settled = (p: Promise<unknown>) =>
    p.then(
      () => 'ok',
      (e: unknown) =>
        (e as { cause?: { code?: string } }).cause?.code ?? String(e),
    );

  it('команда <-> setStatus disabled->published: обидві ok, звірка 0', async () => {
    await db.language('en');
    await add('lt');
    await fillAll('lt');
    await exec(languagesSetStatus, { code: 'lt', status: 'disabled' });
    const { id } = await create({
      uk: { name: 'Замок A' },
      en: { name: 'Lock A' },
    });
    await fillAll('lt');
    const cmd = command(id);
    await until('команда тримає рядок товару', cmd.locked);
    const status = exec(languagesSetStatus, {
      code: 'lt',
      status: 'published',
    });
    // Строго: setStatus (ексклюзивний languages-set) мусить стати в чергу за спільним set команди.
    await waitForBlockedTree(db, cmd, 1, RELEASE);
    cmd.proceed();
    expect(await Promise.all([settled(cmd.done), settled(status)])).toEqual([
      'ok',
      'ok',
    ]);
    expect(
      await db.admin((d) => reconcileProductTexts(d, { limit: 1000 })),
    ).toEqual({
      mismatched: 0,
      fixed: 0,
    });
  });

  it('команда <-> fill: обидві ok, звірка 0', async () => {
    const { id } = await create({
      uk: { name: 'Замок B' },
      en: { name: 'Lock B' },
    });
    await add('bg');
    await db.shared((d) => copyPathsForLocale(d, 'bg', 1000));
    const cmd = command(id);
    await until('команда тримає рядок товару', cmd.locked);
    const fill = fillAll('bg');
    // Усі адреси вже скопійовано: виклик fill будує проєкцію під ЕКСКЛЮЗИВНИМ languages-set
    // і мусить стати в чергу за спільним set команди (фінальне рев'ю М1, N1) — інакше
    // збудував би рядок зі знімка до коміту команди.
    await waitForBlockedTree(db, cmd, 1, RELEASE);
    cmd.proceed();
    expect(await Promise.all([settled(cmd.done), settled(fill)])).toEqual([
      'ok',
      'ok',
    ]);
    expect(
      await db.admin((d) => reconcileProductTexts(d, { limit: 1000 })),
    ).toEqual({
      mismatched: 0,
      fixed: 0,
    });
  });

  describe('паралельне видалення товару/модифікації проти fill і setStatus', () => {
    /** Транзакція видалення: бере корінь, видаляє рядок і тримає до `commit()`. */
    const removing = (
      statement: (d: Parameters<typeof lockProduct>[0]) => Promise<void>,
      id: string,
    ) => {
      const h = hold(db, async (d) => {
        await lockProduct(d, id);
        await statement(d);
      });
      return { ...h, deleted: h.acquired, commit: h.release };
    };
    const raceWith = async (
      id: string,
      statement: (d: Parameters<typeof lockProduct>[0]) => Promise<void>,
      concurrent: () => Promise<unknown>,
    ) => {
      const rm = removing(statement, id);
      await Promise.race([
        until('видалення виконане, транзакція відкрита', rm.deleted),
        rm.done,
      ]);
      const other = concurrent();
      // Строго: конкурент мусить стати на рядок, який видалення ще не закомітило.
      await waitForBlockedTree(db, rm, 1, RELEASE);
      rm.commit();
      return Promise.all([settled(rm.done), settled(other)]);
    };
    const deleteProduct =
      (id: string) => async (d: Parameters<typeof lockProduct>[0]) => {
        await d.execute(
          sql`delete from public.products where id = ${id}::uuid`,
        );
      };

    it('fill (адреси й проєкція) проти видалення товару: товар пропущено, 23503 немає', async () => {
      const { id } = await create({ uk: { name: 'Видалення A' } });
      await add('sk');
      expect(
        await raceWith(id, deleteProduct(id), () => fillAll('sk')),
      ).toEqual(['ok', 'ok']);
      expect(
        await db.q(
          `select 1 from public.catalog_product_texts where product_id = $1`,
          [id],
        ),
      ).toHaveLength(0);
    });

    it('setStatus disabled->published проти видалення товару: товар пропущено, 23503 немає', async () => {
      await add('cs');
      await fillAll('cs');
      await exec(languagesSetStatus, { code: 'cs', status: 'disabled' });
      const { id } = await create({ uk: { name: 'Видалення B' } });
      await fillAll('cs');
      expect(
        await raceWith(id, deleteProduct(id), () =>
          exec(languagesSetStatus, { code: 'cs', status: 'published' }),
        ),
      ).toEqual(['ok', 'ok']);
    });

    it('reconcile (виправлення) проти видалення товару: товар пропущено, 23503 немає', async () => {
      const { id } = await create({ uk: { name: 'Видалення C' } });
      await db.q(
        `delete from public.catalog_product_texts where product_id = $1`,
        [id],
      );
      expect(
        await raceWith(id, deleteProduct(id), () =>
          db.admin((d) => reconcileProductTexts(d, { limit: 1000 })),
        ),
      ).toEqual(['ok', 'ok']);
    });

    it('fill (токени) проти видалення модифікації: модифікацію пропущено, 23503 немає', async () => {
      const product = await db.product('mod-race');
      const mod = await db.modification(product, 'mod-race-m');
      await add('hu');
      expect(
        await raceWith(
          product,
          async (d) => {
            await d.execute(
              sql`delete from public.product_modifications where id = ${mod}::uuid`,
            );
          },
          () => fillAll('hu'),
        ),
      ).toEqual(['ok', 'ok']);
    });
  });

  describe('fill проти видалення модифікацій у протилежному порядку (корінь, 40P01)', () => {
    /** Дві модифікації: id a < b, а slug навпаки — fill копіює токени b -> a, видаляч бере a -> b. */
    const withTwoModifications = async (name: string) => {
      const { id } = await create({ uk: { name } });
      const [a, b] = [randomUUID(), randomUUID()].sort();
      await insertModificationAt(db.url(), id, {
        id: a!,
        slug: 'zz-mod',
        name: 'A',
      });
      await insertModificationAt(db.url(), id, {
        id: b!,
        slug: 'aa-mod',
        name: 'B',
      });
      return { id, a: a!, b: b! };
    };
    /** T0 тримає KEY SHARE на b: видаляч зависає між замками a і b, fill встигає взяти b. */
    const latch = (b: string) =>
      hold(db, (d) =>
        d.execute(
          sql`select 1 from public.product_modifications where id = ${b}::uuid for key share`,
        ),
      );
    const race = async (
      b: string,
      remover: () => Promise<unknown>,
      code: string,
    ) => {
      const t0 = latch(b);
      await until('T0 тримає KEY SHARE', t0.acquired);
      const removal = remover();
      // Строго: видаляч мусить дійти до a і стати на b (T0), перш ніж стартує fill.
      await waitForBlockedTree(db, t0, 1, RELEASE);
      const fill = fillAll(code);
      // Строго: fill бере b раніше за видаляча, тому стає в чергу (на T0 чи на видаляча).
      await waitForBlockedTree(db, t0, 2, RELEASE);
      t0.release();
      return Promise.all([settled(removal), settled(fill), t0.done]);
    };
    const clean = async () =>
      expect(
        await db.admin((d) => reconcileProductTexts(d, { limit: 1000 })),
      ).toEqual({
        mismatched: 0,
        fixed: 0,
      });

    it('fill <-> products.remove товару з двома модифікаціями: ok/ok, звірка 0', async () => {
      const { id, b } = await withTwoModifications('Корінь A');
      await add('da');
      const [rm, fill] = await race(
        b,
        async () => {
          const out = await get(id);
          return exec(productsRemove, { id, expectedVersion: out.version });
        },
        'da',
      );
      expect([rm, fill]).toEqual(['ok', 'ok']);
      await clean();
    });

    it('fill <-> saveDescription, що видаляє дві модифікації: ok/ok, звірка 0', async () => {
      const { id, a, b } = await withTwoModifications('Корінь B');
      await add('no');
      const [rm, fill] = await race(
        b,
        async () =>
          saveDescription(id, (await get(id)).version, {
            modifications: { remove: [a, b] },
          }),
        'no',
      );
      expect([rm, fill]).toEqual(['ok', 'ok']);
      await clean();
    });
  });

  it('reconcile (виправлення) проти команди: не перезаписує свіжий рядок застарілим (І23)', async () => {
    const { id } = await create({ uk: { name: 'Звірка' } });
    // Розбіжність, яку reconcile побачить у закоміченому стані: рядка en немає.
    await db.q(
      `delete from public.catalog_product_texts where product_id = $1 and locale = 'en'`,
      [id],
    );
    const command = hold(db, async (d) => {
      await lockProduct(d, id);
      await d.execute(
        sql`update public.product_translations set name = 'Нова' where product_id = ${id}::uuid and locale = 'uk'`,
      );
      await refreshProductTexts(d, [id]);
    });
    await until('команда записала рядок', command.acquired);
    const recon = db.admin((d) => reconcileProductTexts(d, { limit: 1000 }));
    // Строго: reconcile мусить стати на рядок товару, який тримає команда.
    await waitForBlockedTree(db, command, 1, RELEASE);
    command.release();
    await Promise.all([command.done, recon]);
    expect(
      (
        await db.q(
          `select name from public.catalog_product_texts where product_id = $1 and locale = 'en'`,
          [id],
        )
      )[0]?.name,
    ).toBe('Нова');
    expect(
      await db.admin((d) => reconcileProductTexts(d, { limit: 1000 })),
    ).toEqual({
      mismatched: 0,
      fixed: 0,
    });
  });
});
