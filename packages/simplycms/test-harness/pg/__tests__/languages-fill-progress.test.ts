// М1 Task 14, фікс-раунд 4 (I-2): товар, для якого рядок проєкції побудувати неможливо
// (немає рядка джерела), не займає пакет fill вічно — вибір і побудова мають ОДИН
// предикат, а розбіжність дає голосну відмову з переліком id, а не `done: false` без кінця.
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  languagesAdd,
  languagesFill,
  languagesSetStatus,
} from 'simplycms/admin-server/impl';
import { useAddressingDb } from './fixtures/addressing-db';
import { create, exec } from './fixtures/product-aggregate';

describe('languages.fill: прогрес на товарах без джерела (I-2)', () => {
  const db = useAddressingDb('simplycms_languages_fill_progress');
  const add = (code: string) =>
    exec(languagesAdd, { id: randomUUID(), code, name: code });

  /** Три товари; у двох найменших за id прибрано рядок джерела (дані в обхід команди). */
  const seed = async () => {
    const ids = (
      await Promise.all(
        ['A', 'B', 'C'].map((n) => create({ uk: { name: `Прогрес ${n}` } })),
      )
    )
      .map((p) => p.id)
      .sort();
    const [x, y, normal] = ids as [string, string, string];
    // Тригер обовʼязкового джерела вимкнено лише для цієї транзакції фікстури.
    await db.q(`begin;
      set local session_replication_role = replica;
      delete from public.product_translations
       where product_id in ('${x}', '${y}');
      commit;`);
    return { normal };
  };

  it('fill з batch 2 завершується, а товар без пропуску отримує адресу й проєкцію', async () => {
    const { normal } = await seed();
    await add('lv');
    const calls: { inserted: number; done: boolean }[] = [];
    for (let i = 0; i < 10 && !calls.at(-1)?.done; i += 1)
      calls.push(await exec(languagesFill, { code: 'lv', batch: 2 }));
    expect(calls.at(-1)?.done).toBe(true);
    // Повторний виклик після `done` — порожній прохід: тут спрацював би запобіжник,
    // якби вибір «бракує» розійшовся з етапами.
    expect(await exec(languagesFill, { code: 'lv', batch: 2 })).toEqual({
      inserted: 0,
      done: true,
    });
    expect(
      await db.q(
        `select 1 from public.url_paths where product_id = $1 and locale = 'lv' and is_current`,
        [normal],
      ),
    ).toHaveLength(1);
    expect(
      await db.q(
        `select 1 from public.catalog_product_texts where product_id = $1 and locale = 'lv'`,
        [normal],
      ),
    ).toHaveLength(1);
  });

  it('setStatus disabled -> draft дозбирає проєкцію без хибної відмови запобіжника', async () => {
    await add('lt');
    await exec(languagesSetStatus, { code: 'lt', status: 'disabled' });
    await seed();
    for (let i = 0; i < 10; i += 1)
      if ((await exec(languagesFill, { code: 'lt', batch: 2 })).done) break;
    const out = await exec(languagesSetStatus, { code: 'lt', status: 'draft' });
    expect(out.status).toBe('draft');
  });
});
