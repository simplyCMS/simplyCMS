// М1 Task 14, мінор-раунд (m-2): `done` пакета fill — «за предикатом `pendingFill` роботи для
// мови не лишилось», а `inserted` — фактично вставлені рядки. Пропущений `ON CONFLICT`
// рядок (поточну адресу щойно вставила команда) зменшує лічильник, але не робить мову готовою.
// Окрема база: кандидатів рівно три, жоден чужий товар не входить у пакет.
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  languagesAdd,
  languagesFill,
  languagesSetStatus,
  productsSetPath,
} from 'simplycms/admin-server/impl';
import { useAddressingDb } from './fixtures/addressing-db';
import { latchRace } from './fixtures/latch-race';
import { create, exec, get } from './fixtures/product-aggregate';

describe('languages.fill: done за предикатом, inserted за фактом (m-2)', () => {
  const db = useAddressingDb('simplycms_languages_fill_done');

  it('пакет зі пропущеним конфліктом: inserted 1, done false, наступний виклик добирає третій товар', async () => {
    const d1 = (await create({ uk: { name: 'D1' } })).id;
    const d2 = (await create({ uk: { name: 'D2' } })).id;
    const d3 = (await create({ uk: { name: 'D3' } })).id;
    const [q, p] = [d1, d2].sort() as [string, string];
    await exec(languagesAdd, { id: randomUUID(), code: 'xx', name: 'xx' });
    // Без проєкції: пакет вставляє лише адреси, лічильник не змішується з рядками тексту.
    await exec(languagesSetStatus, { code: 'xx', status: 'disabled' });
    let first: unknown;
    const out = await latchRace(
      db,
      // fill прочитав кандидатів пакета (d1, d2 — за шляхом) і чекає KEY SHARE меншого
      `select 1 from public.products where id = '${q}' for update`,
      async () => {
        first = await exec(languagesFill, { code: 'xx', batch: 2 });
      },
      async () =>
        exec(productsSetPath, {
          id: p,
          locale: 'xx',
          path: 'p-explicit',
          expectedVersion: (await get(p)).version,
        }),
    );
    expect(out).toEqual(['ok', 'ok']);
    expect(first).toEqual({ inserted: 1, done: false });
    expect(await exec(languagesFill, { code: 'xx', batch: 2 })).toEqual({
      inserted: 1,
      done: true,
    });
    const rows = await db.q(
      `select product_id from public.url_paths where locale = 'xx' and is_current order by 1`,
    );
    expect(rows.map((r) => r.product_id)).toEqual([d1, d2, d3].sort());
  });
});
