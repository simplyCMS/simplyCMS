// М1 Task 14, фікс-раунд 1 (I-1): порядок замків «рядок товару -> languages-set» команди
// проти «languages-set -> FK на рядок товару» у setStatus/fill не дає 40P01.
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
} from 'simplycms/admin-server/impl';
import { lockProduct } from '../../../src/admin-server/impl/products/aggregate/load';
import { useAddressingDb } from './fixtures/addressing-db';
import { sleep, until } from './fixtures/lock-holders';
import { create, exec } from './fixtures/product-aggregate';

describe('замки команди товару проти setStatus і fill (М1, Task 14, I-1)', () => {
  const db = useAddressingDb('simplycms_catalog_projection_locks');
  const add = (code: string) =>
    exec(languagesAdd, { id: randomUUID(), code, name: code });
  const fillAll = async (code: string) => {
    for (let i = 0; i < 50; i += 1)
      if ((await exec(languagesFill, { code, batch: 2 })).done) return;
    throw new Error('fill не завершився');
  };

  /** Команда: lockProduct -> пауза до `proceed` -> refresh, як текстова команда агрегата. */
  const command = (id: string) => {
    let proceed!: () => void;
    const gate = new Promise<void>((r) => (proceed = r));
    let locked = false;
    const done = db.admin(async (d) => {
      await lockProduct(d, id);
      locked = true;
      await gate;
      await refreshProductTexts(d, [id]);
    });
    return { locked: () => locked, proceed, done };
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
    await sleep(500);
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
    await sleep(500);
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
      let commit!: () => void;
      const gate = new Promise<void>((r) => (commit = r));
      let deleted = false;
      const done = db.admin(async (d) => {
        await lockProduct(d, id);
        await statement(d);
        deleted = true;
        await gate;
      });
      return { deleted: () => deleted, commit, done };
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
      await sleep(500);
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

    it('fill (токени) проти видалення модифікації: модифікацію пропущено, 23503 немає', async () => {
      const product = await db.product('mod-race', true);
      const mod = await db.modification(product, 'mod-race-m');
      await db.w(
        `insert into public.slug_tokens (id, locale, scope_id, slug, modification_id, is_current)
         values (gen_random_uuid(), 'uk', $1::uuid, 'mod-race-m', $2::uuid, true)`,
        [product, mod],
      );
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
});
