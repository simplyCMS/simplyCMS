// М1 Task 11, І13 і Review Focus 4: гонка «переклад проти зміни джерела».
// Детермінізм — без випадкової перемоги: зовнішнє з'єднання тримає рядок
// джерела `product_translations(uk)`, тож saveDescription (A) зависає ПІСЛЯ
// того, як взяв корінь `FOR UPDATE`. Переклад (B) мусить стати за коренем; якщо
// він іде повз корінь, його не видно за `stillPending`, а після релізу він
// мовчки пише переклад зі старого джерела замість відмови.
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  SourceChangedError,
  VersionMismatchError,
} from 'simplycms/contracts/domain-errors';
import { sourceFieldHash } from 'simplycms/translations';
import { holdRowLock, stillPending } from './fixtures/advisory-lock';
import { useAddressingDb } from './fixtures/addressing-db';
import {
  create,
  get,
  saveDescription,
  saveTranslation,
} from './fixtures/product-aggregate';

describe('гонка перекладу і зміни джерела (І13)', () => {
  const db = useAddressingDb('simplycms_translation_race');
  const open: { cleanup: () => Promise<void> }[] = [];
  afterEach(async () => {
    for (const l of open.splice(0)) await l.cleanup();
  });
  const rejects = (p: Promise<unknown>) =>
    p.then(
      () => null,
      (e: unknown) => e,
    );
  const seed = () =>
    create({
      uk: { name: 'Кабель', description: '<p>Старий</p>' },
      en: { name: 'Cable', description: '<p>Old</p>' },
    });

  /** Чекає, поки хоч один бекенд стане за локом із `pid` (операція дійшла до запису). */
  const waitBlockedBy = async (pid: number) => {
    for (let i = 0; i < 100; i += 1) {
      const rows = await db.q(
        `select 1 from pg_stat_activity where $1 = any(pg_blocking_pids(pid))`,
        [pid],
      );
      if (rows.length > 0) return;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error('операція не дійшла до запису');
  };

  beforeAll(async () => {
    await db.language('en');
  });

  it('A (saveDescription uk.description) уже тримає корінь → B (saveTranslation en) чекає, потім 412; en не став current', async () => {
    const { id, version } = await seed();
    const lock = await holdRowLock(
      db.url(),
      `select 1 from public.product_translations where product_id = $1 and locale = 'uk' for update`,
      [id],
    );
    open.push(lock);
    const a = saveDescription(id, version, {
      texts: { uk: { description: '<p>Новий</p>' } },
    });
    await waitBlockedBy(lock.pid);
    const b = saveTranslation(
      id,
      version,
      'en',
      { description: '<p>New</p>' },
      { description: sourceFieldHash('<p>Старий</p>') },
    );
    // Корінь тримає A: B не сміє ні прочитати, ні записати, доки A не завершиться.
    expect(await stillPending(b, 700)).toBe(true);
    await lock.release();
    await a;
    const err = await rejects(b);
    expect(err).toBeInstanceOf(VersionMismatchError);
    const after = await get(id);
    expect(after.version).toBe(version + 1);
    expect(after.texts.en!.description).toBe('<p>Old</p>');
    expect(after.texts.en!.fieldStatus.description).toBe('outdated');
    // СТАН хеша: збережений хеш en.description — від старого джерела, не від нового.
    const [en] = await db.q(
      `select source_hashes from public.product_translations where product_id = $1 and locale = 'en'`,
      [id],
    );
    expect((en!.source_hashes as Record<string, string>).description).toBe(
      sourceFieldHash('<p>Старий</p>'),
    );
    expect((en!.source_hashes as Record<string, string>).description).not.toBe(
      sourceFieldHash('<p>Новий</p>'),
    );
  });

  it('два паралельні saveTranslation з тією самою версією: рівно один проходить', async () => {
    const { id, version } = await seed();
    const expected = { description: sourceFieldHash('<p>Старий</p>') };
    const results = await Promise.all([
      rejects(
        saveTranslation(
          id,
          version,
          'en',
          { description: '<p>A</p>' },
          expected,
        ),
      ),
      rejects(
        saveTranslation(
          id,
          version,
          'en',
          { description: '<p>B</p>' },
          expected,
        ),
      ),
    ]);
    expect(results.filter((r) => r === null)).toHaveLength(1);
    expect(
      results.filter((r) => r instanceof VersionMismatchError),
    ).toHaveLength(1);
    expect((await get(id)).version).toBe(version + 1);
    expect((await get(id)).texts.en!.fieldStatus.description).toBe('current');
  });

  it('свіжа версія, старі хеші (джерело змінено поза версією) → 409, не current', async () => {
    const { id, version } = await seed();
    // Джерело змінено в обхід агрегата: версія та сама, хеш інший.
    await db.q(
      `update public.product_translations set description = '<p>Інакше</p>' where product_id = $1 and locale = 'uk'`,
      [id],
    );
    const err = await rejects(
      saveTranslation(
        id,
        version,
        'en',
        { description: '<p>X</p>' },
        {
          description: sourceFieldHash('<p>Старий</p>'),
        },
      ),
    );
    expect(err).toBeInstanceOf(SourceChangedError);
    const [en] = await db.q(
      `select description, source_hashes from public.product_translations where product_id = $1 and locale = 'en'`,
      [id],
    );
    expect(en!.description).toBe('<p>Old</p>');
    expect((await get(id)).texts.en!.fieldStatus.description).toBe('outdated');
  });
});
