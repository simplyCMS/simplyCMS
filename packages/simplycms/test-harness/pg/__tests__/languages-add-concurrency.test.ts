// М1 Task 6, Review Focus 1: магазин додає мову, поки адмін створює товари —
// кожен товар, створений до й під час додавання, мусить мати адресу в новій
// мові. Порядок «замок → набір мов» доводять три сценарії.
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createPathsForEntity,
  createTokensForEntity,
} from 'simplycms/addressing';
import { advisoryXactLock } from 'simplycms/db';
import { LOCK_KEYS } from 'simplycms/db/lock-keys';
import {
  languagesAdd,
  languagesFill,
  languagesRemove,
  languagesSetStatus,
} from 'simplycms/admin-server/impl';
import { executeOperation } from 'simplycms/operations';
import { languages } from 'simplycms/schema';
import { ADMIN, useAddressingDb } from './fixtures/addressing-db';
import { hold, until, waiters } from './fixtures/lock-holders';

const subject = { userId: ADMIN.userId, roles: ['admin' as const] };

describe('languages.add проти паралельного створення товарів (Review Focus 1)', () => {
  const db = useAddressingDb('simplycms_languages_add_concurrency');
  const addLanguage = (code: string) =>
    executeOperation(
      languagesAdd,
      { id: randomUUID(), code, name: code },
      subject,
    );
  const fillAll = async (code: string) => {
    for (let i = 0; i < 50; i += 1) {
      const r = await executeOperation(languagesFill, { code }, subject);
      if (!r.replayed && r.output.done) return;
    }
    throw new Error('fill не завершився');
  };
  const pathIn = async (productId: string, locale: string) =>
    db.q(
      `select path from public.url_paths where product_id = $1 and locale = $2 and is_current`,
      [productId, locale],
    );
  const createAddress = (productId: string, slug: string) =>
    hold(db, (d) =>
      createPathsForEntity(d, { kind: 'product', id: productId }, slug),
    );

  it('A створює адресу під спільним замком і тримається → add чекає → після обох комітів fill дає товару адресу в новій мові', async () => {
    const product = await db.product('conc-a');
    const a = createAddress(product, 'conc-a');
    await until('A отримала замок і вставила адресу', a.acquired);

    let addDone = false;
    const b = addLanguage('pl').then(() => {
      addDone = true;
    });
    await until(
      'add став у чергу на ексклюзивний замок',
      async () => (await waiters(db)) === 1,
    );
    expect(addDone).toBe(false);

    a.release();
    await Promise.all([a.done, b]);
    await fillAll('pl');
    expect(await pathIn(product, 'pl')).toHaveLength(1);
  });

  it('товар, створений ПІСЛЯ коміту мови, одразу має адресу в draft-мові', async () => {
    await addLanguage('cs');
    const product = await db.product('conc-b');
    const a = createAddress(product, 'conc-b');
    await until('адреси створено', a.acquired);
    a.release();
    await a.done;
    expect(await pathIn(product, 'cs')).toHaveLength(1);
    expect(await pathIn(product, 'uk')).toHaveLength(1);
  });

  it('add тримає ексклюзивний замок → створення товару чекає й бачить нову мову (замок ДО читання набору)', async () => {
    const product = await db.product('conc-c');
    const b = hold(db, async (d) => {
      await advisoryXactLock(d, LOCK_KEYS.languagesSet);
      await d
        .insert(languages)
        .values({ id: randomUUID(), code: 'sv', name: 'sv', status: 'draft' });
    });
    await until('add отримав замок', b.acquired);

    const a = createAddress(product, 'conc-c');
    await until(
      'створення товару стало в чергу',
      async () => (await waiters(db)) === 1,
    );
    b.release();
    await b.done;
    await until('A вставила адреси', a.acquired);

    // fill проходить, поки A не закомічена: товару він не бачить.
    await fillAll('sv');
    a.release();
    await a.done;
    expect(await pathIn(product, 'sv')).toHaveLength(1);
  });

  const tokenIn = (modificationId: string, locale: string) =>
    db.q(
      `select slug from public.slug_tokens where modification_id = $1 and locale = $2 and is_current`,
      [modificationId, locale],
    );
  const createToken = (productId: string, id: string, slug: string) =>
    hold(db, (d) =>
      createTokensForEntity(
        d,
        { kind: 'modification', id, scopeId: productId },
        slug,
      ),
    );

  it('токени: A створює токен модифікації під спільним замком → add чекає → fill дає токен у новій мові', async () => {
    const product = await db.product('conc-t1');
    const mod = await db.modification(product, 'conc-t1-m');
    const a = createToken(product, mod, 'conc-t1-m');
    await until('A отримала замок і вставила токен', a.acquired);
    let addDone = false;
    const b = addLanguage('da').then(() => {
      addDone = true;
    });
    await until('add став у чергу', async () => (await waiters(db)) === 1);
    expect(addDone).toBe(false);
    a.release();
    await Promise.all([a.done, b]);
    await fillAll('da');
    expect(await tokenIn(mod, 'da')).toHaveLength(1);
  });

  it('токени: add тримає ексклюзивний замок → створення токена чекає й бачить нову мову (замок ДО читання набору)', async () => {
    const product = await db.product('conc-t2');
    const mod = await db.modification(product, 'conc-t2-m');
    const b = hold(db, async (d) => {
      await advisoryXactLock(d, LOCK_KEYS.languagesSet);
      await d
        .insert(languages)
        .values({ id: randomUUID(), code: 'no', name: 'no', status: 'draft' });
    });
    await until('add отримав замок', b.acquired);
    const a = createToken(product, mod, 'conc-t2-m');
    await until(
      'створення токена стало в чергу',
      async () => (await waiters(db)) === 1,
    );
    b.release();
    await b.done;
    await until('A вставила токени', a.acquired);
    await fillAll('no');
    a.release();
    await a.done;
    expect(await tokenIn(mod, 'no')).toHaveLength(1);
  });

  it('disabled → draft чекає творця адреси; творець комітиться без 23514', async () => {
    await addLanguage('ja');
    await fillAll('ja');
    await executeOperation(
      languagesSetStatus,
      { code: 'ja', status: 'disabled' },
      subject,
    );
    const product = await db.product('conc-d1');
    const a = createAddress(product, 'conc-d1');
    await until(
      'A вставила адресу (ja disabled — без адреси в ja)',
      a.acquired,
    );
    let done = false;
    const b = executeOperation(
      languagesSetStatus,
      { code: 'ja', status: 'draft' },
      subject,
    ).then(() => {
      done = true;
    });
    await until(
      'зміна статусу стала в чергу',
      async () => (await waiters(db)) === 1,
    );
    expect(done).toBe(false);
    a.release();
    await expect(a.done).resolves.toBeUndefined();
    await b;
    expect(await pathIn(product, 'ja')).toHaveLength(0);
  });

  it('remove чекає творця адреси; творець комітиться без 23514/409', async () => {
    await addLanguage('ko');
    const product = await db.product('conc-r1');
    const a = createAddress(product, 'conc-r1');
    await until('A вставила адреси (у тому числі ko)', a.acquired);
    let done = false;
    const b = executeOperation(languagesRemove, { code: 'ko' }, subject).then(
      () => {
        done = true;
      },
    );
    await until('remove став у чергу', async () => (await waiters(db)) === 1);
    expect(done).toBe(false);
    a.release();
    await expect(a.done).resolves.toBeUndefined();
    await b;
    expect(await pathIn(product, 'ko')).toHaveLength(0);
    expect(await pathIn(product, 'uk')).toHaveLength(1);
  });
});
