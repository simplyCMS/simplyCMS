// М1 Task 14, фікс-раунд 5: порядок «languages-set -> корінь -> дочірні» (`lock-order.ts`,
// пункт (1)). Команди й видалення товару беруть спільний `languages-set` у замку кореня,
// ДО рядка кореня і будь-яких дочірніх рядків; власники ексклюзивного (`languages.remove`,
// `setStatus`) рядкових замків коренів не беруть, але видаляють/блокують ті самі таблиці.
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { advisoryXactLockShared } from 'simplycms/db';
import { LOCK_KEYS } from 'simplycms/db/lock-keys';
import {
  languagesAdd,
  languagesFill,
  languagesRemove,
  languagesSetStatus,
  productsRemove,
} from 'simplycms/admin-server/impl';
import { sourceFieldHash } from 'simplycms/translations';
import { pathHelpers, useAddressingDb } from './fixtures/addressing-db';
import { latchRace } from './fixtures/latch-race';
import { insertModificationAt } from './fixtures/product-graph';
import {
  create,
  exec,
  get,
  saveTranslation,
} from './fixtures/product-aggregate';

describe('languages-set перед коренем агрегата (Task 14, раунд 5)', () => {
  const db = useAddressingDb('simplycms_aggregate_language_locks');
  const { addr } = pathHelpers(db);
  const add = (code: string) =>
    exec(languagesAdd, { id: randomUUID(), code, name: code });
  const fillAll = async (code: string) => {
    for (let i = 0; i < 50; i += 1)
      if ((await exec(languagesFill, { code })).done) return;
    throw new Error('fill не завершився');
  };
  const removeProduct = (id: string) => async () =>
    exec(productsRemove, { id, expectedVersion: (await get(id)).version });

  it('saveTranslation <-> languages.remove тієї ж мови: без 40P01, команда — доменна відмова', async () => {
    await add('lt');
    const { id, version } = await create({ uk: { name: 'Вік' } });
    // T0 тримає KEY SHARE на рядку мови: remove (ексклюзивний set) чекає на нього; команда,
    // що писала б переклад раніше за set, тримала б KEY SHARE мови й чекала б set.
    const out = await latchRace(
      db,
      `select 1 from public.languages where code = 'lt' for key share`,
      () => exec(languagesRemove, { code: 'lt' }),
      () =>
        saveTranslation(
          id,
          version,
          'lt',
          { name: 'Vik' },
          { name: sourceFieldHash('Вік') },
        ),
    );
    // Мова зникла, поки команда чекала set: відмова валідації, а не 500.
    expect(out).toEqual(['ok', 'ValidationError']);
  });

  it('products.remove <-> setStatus disabled->published: ok/ok', async () => {
    await add('lv');
    await fillAll('lv');
    await exec(languagesSetStatus, { code: 'lv', status: 'disabled' });
    const { id } = await create({ uk: { name: 'Статус' } });
    await fillAll('lv');
    // T0 тримає спільний set: setStatus стає в чергу за ексклюзивним; видалення, що взяло б
    // корінь FOR UPDATE раніше за set, зустрілось би з KEY SHARE дозбірки проєкції.
    const out = await latchRace(
      db,
      (d) => advisoryXactLockShared(d, LOCK_KEYS.languagesSet),
      () => exec(languagesSetStatus, { code: 'lv', status: 'published' }),
      removeProduct(id),
    );
    expect(out).toEqual(['ok', 'ok']);
  });

  it('products.remove (дві історичні адреси в мові) <-> languages.remove: ok/ok', async () => {
    await add('hr');
    const { id } = await create({
      uk: { name: 'Історія' },
      hr: { name: 'Povijest' },
    });
    await insertModificationAt(db.url(), id, {
      id: randomUUID(),
      slug: 'hist-mod',
      name: 'M',
    });
    await fillAll('hr');
    await exec(languagesSetStatus, { code: 'hr', status: 'disabled' });
    await addr('hr', `hist-1-${id}`, id, false);
    await addr('hr', `hist-2-${id}`, id, false);
    const price = randomUUID();
    await db.q(
      `insert into public.product_prices (id, price_type_id, product_id, price)
       values ($1, (select id from public.price_types where code = 'retail'), $2, 10)`,
      [price, id],
    );
    // T0 тримає ціну товару: видалення вже прибрало модифікації (токени мови hr) і чекає в
    // каскаді товару ДО перекладів; remove мови каскадом бере переклад (товар, hr), потім
    // токени — без set з боку видалення порядки протилежні (40P01).
    const out = await latchRace(
      db,
      `select 1 from public.product_prices where id = '${price}' for key share`,
      removeProduct(id),
      () => exec(languagesRemove, { code: 'hr' }),
    );
    expect(out).toEqual(['ok', 'ok']);
  });
});
