// М1 Task 14, І23: паритет SQL-предиката `is_translated` з `isTranslatedForSeo`,
// замок набору мов у refresh і гонка fill з командою (два з'єднання).
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { copyPathsForLocale } from 'simplycms/addressing';
import {
  reconcileProductTexts,
  refreshProductTexts,
} from 'simplycms/catalog-projection';
import { advisoryXactLock } from 'simplycms/db';
import { LOCK_KEYS } from 'simplycms/db/lock-keys';
import { languagesFill } from 'simplycms/admin-server/impl';
import {
  fallbackFieldsOf,
  isTranslatedForSeo,
} from 'simplycms/domain/translations';
import { TRANSLATABLE } from 'simplycms/translations';
import { lockProduct } from '../../../src/admin-server/impl/products/aggregate/load';
import { useAddressingDb } from './fixtures/addressing-db';
import { hold, until, waiters } from './fixtures/lock-holders';
import {
  create,
  exec,
  get,
  saveDescription,
} from './fixtures/product-aggregate';

describe('проєкція тексту: паритет, замок, гонка fill (М1, Task 14)', () => {
  const db = useAddressingDb('simplycms_catalog_projection_parity');
  const reconcile = () =>
    db.admin((d) => reconcileProductTexts(d, { limit: 10_000 }));
  const proj = async (id: string, locale: string) =>
    (
      await db.q(
        `select * from public.catalog_product_texts where product_id = $1 and locale = $2`,
        [id, locale],
      )
    )[0];
  const refresh = (id: string, locales?: string[]) =>
    db.admin((d) => refreshProductTexts(d, [id], locales));
  const version = async (id: string) => (await get(id)).version;
  const rejects = async (p: Promise<unknown>) =>
    p.then(
      () => null,
      (e: unknown) => e,
    );

  it('рядки, записані КОМАНДОЮ: SQL збігається з isTranslatedForSeo на векторах порожнього', async () => {
    await db.language('en');
    const vectors = ['', '   ', '<p></p>', '<p>&nbsp;</p>', '<p>Текст</p>'];
    for (const [i, source] of vectors.entries()) {
      for (const target of vectors) {
        const { id } = await create({
          uk: { name: `Тест ${i}` },
          en: { name: 'Test' },
        });
        await saveDescription(id, await version(id), {
          texts: {
            uk: { description: source, shortDescription: source },
            en: { description: target, shortDescription: target },
          },
        });
        const uk = (await get(id)).texts;
        const row = await proj(id, 'en');
        const sourceRow = {
          values: {
            name: `Тест ${i}`,
            short_description: uk.uk?.shortDescription,
            description: uk.uk?.description,
          },
        };
        const targetRow = {
          values: {
            name: 'Test',
            short_description: uk.en?.shortDescription,
            description: uk.en?.description,
          },
        };
        const want = isTranslatedForSeo(
          TRANSLATABLE.product,
          sourceRow,
          targetRow,
        );
        // fallback_fields: SQL і TS-двійник збігаються на тих самих векторах.
        expect(
          row?.fallback_fields,
          `${JSON.stringify([source, target])}`,
        ).toEqual(fallbackFieldsOf(TRANSLATABLE.product, sourceRow, targetRow));
        expect(row?.is_translated, `${JSON.stringify([source, target])}`).toBe(
          want,
        );
      }
    }
    expect(await reconcile()).toEqual({ mismatched: 0, fixed: 0 });
  });

  it("плоскі '' та пробіли в обхід команди відхиляє CHECK у БД", async () => {
    const { id } = await create({
      uk: { name: 'Плоске' },
      en: { name: 'Flat' },
    });
    for (const column of [
      'name',
      'short_description',
      'meta_title',
      'meta_description',
    ])
      for (const blank of ['', '   ', '\t\n', ' ', '​'])
        expect(
          await rejects(
            db.q(
              `update public.product_translations set ${column} = $2 where product_id = $1 and locale = 'en'`,
              [id, blank],
            ),
          ),
          `${column} = ${JSON.stringify(blank)}`,
        ).toMatchObject({ code: '23514' });
  });

  it("rich '<p></p>' та '<p>&nbsp;</p>' в обхід команди: розбіжність видно у звірці, а не мовчки", async () => {
    for (const empty of ['<p></p>', '<p>&nbsp;</p>']) {
      // Порожній rich у ПЕРЕКЛАДІ: SQL бачить `NOT NULL` → «перекладено», TS — ні.
      const a = await create({
        uk: { name: 'Rich A', description: '<p>Опис</p>' },
        en: { name: 'Rich A' },
      });
      await db.q(
        `update public.product_translations set description = $2 where product_id = $1 and locale = 'en'`,
        [a.id, empty],
      );
      await refresh(a.id);
      expect((await proj(a.id, 'en'))?.is_translated).toBe(true);
      expect(await reconcile()).toEqual({ mismatched: 1, fixed: 0 });
      // Порожній rich у ДЖЕРЕЛІ: SQL бачить `NOT NULL` → вимагає переклад, TS — ні.
      await db.q(
        `update public.product_translations set description = null where product_id = $1 and locale = 'en'`,
        [a.id],
      );
      await db.q(
        `update public.product_translations set description = $2 where product_id = $1 and locale = 'uk'`,
        [a.id, empty],
      );
      await refresh(a.id);
      expect((await proj(a.id, 'en'))?.is_translated).toBe(false);
      expect(await reconcile()).toEqual({ mismatched: 1, fixed: 0 });
      await db.q(
        `update public.product_translations set description = null where product_id = $1 and locale = 'uk'`,
        [a.id],
      );
      await refresh(a.id);
      expect(await reconcile()).toEqual({ mismatched: 0, fixed: 0 });
    }
  });

  it('refresh бере спільний замок і читає набір мов ПІСЛЯ нього (П5)', async () => {
    await db.language('fr', 'draft');
    const { id } = await create({
      uk: { name: 'Замок' },
      en: { name: 'Lock' },
    });
    expect(await proj(id, 'fr')).toBeDefined();
    // Ексклюзивний власник набору мов вимикає fr і тримає транзакцію.
    const holder = hold(db, async (d) => {
      await advisoryXactLock(d, LOCK_KEYS.languagesSet);
      await d.execute(
        sql`update public.languages set status = 'disabled' where code = 'fr'`,
      );
    });
    await until('власник набору мов тримає замок', holder.acquired);
    const run = refresh(id);
    await until('refresh чекає замок', async () => (await waiters(db)) === 1);
    holder.release();
    await Promise.all([holder.done, run]);
    // Refresh прочитав fr уже як disabled і прибрав її рядок.
    expect(await proj(id, 'fr')).toBeUndefined();
    await db.w(
      `update public.languages set status = 'draft' where code = 'fr'`,
    );
    await reconcile();
    expect(await reconcile()).toEqual({ mismatched: 0, fixed: 0 });
  });

  it('fill проти команди (два з`єднання): рядок команди свіжий, fill його не перезаписує (П5)', async () => {
    const { id } = await create({ uk: { name: 'Старе' }, en: { name: 'Old' } });
    await db.language('bg', 'draft');
    await db.shared((d) => copyPathsForLocale(d, 'bg', 1000));
    expect(await proj(id, 'bg')).toBeUndefined();
    // Команда: оновлює джерело й пише рядок bg (не закомічений).
    const command = hold(db, async (d) => {
      // Справжній порядок команди: корінь агрегата, потім джерело й проєкція.
      await lockProduct(d, id);
      await d.execute(
        sql`update public.product_translations set name = 'Нове' where product_id = ${id}::uuid and locale = 'uk'`,
      );
      await refreshProductTexts(d, [id]);
    });
    await until('команда записала рядок', command.acquired);
    // Fill бачить закомічений знімок (старе джерело) і впирається в рядок команди.
    const fill = exec(languagesFill, { code: 'bg' });
    await until('fill чекає транзакцію команди', async () => {
      const r = await db.q(
        `select count(*)::int n from pg_stat_activity
          where datname = current_database() and wait_event_type = 'Lock'`,
      );
      return Number(r[0]?.n) >= 1;
    });
    command.release();
    await Promise.all([command.done, fill]);
    expect((await proj(id, 'bg'))?.name).toBe('Нове');
    expect(await reconcile()).toEqual({ mismatched: 0, fixed: 0 });
  });

  it('refresh порожнього набору й невідомого товару — no-op', async () => {
    await db.admin((d) => refreshProductTexts(d, []));
    await db.admin((d) => refreshProductTexts(d, [randomUUID()]));
    expect(await reconcile()).toEqual({ mismatched: 0, fixed: 0 });
  });
});
