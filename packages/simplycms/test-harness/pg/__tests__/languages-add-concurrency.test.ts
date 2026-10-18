// М1 Task 6, Review Focus 1: магазин додає мову, поки адмін створює товари —
// кожен товар, створений до й під час додавання, мусить мати адресу в новій
// мові. Порядок «замок → набір мов» доводять три сценарії.
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { AdminNotFoundError } from 'simplycms/contracts/domain-errors';
import {
  createPathsForEntity,
  createTokensForEntity,
  setExplicitPath,
  setExplicitToken,
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
import {
  ADMIN,
  freshModificationSql,
  freshProductSql,
  useAddressingDb,
} from './fixtures/addressing-db';
import {
  hold,
  until,
  waiters,
  waitForBlockedTree,
} from './fixtures/lock-holders';

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
  /**
   * «Створення товару»: новий рядок графа й адреси генератором в ОДНІЙ транзакції, що
   * тримається до `release` (як `products.create`; тригер наявності — на її COMMIT).
   */
  const createAddress = (productId: string, slug: string) =>
    hold(db, async (d) => {
      await d.execute(sql.raw(freshProductSql(productId, slug)));
      await createPathsForEntity(d, { kind: 'product', id: productId }, slug);
    });

  it('A створює адресу під спільним замком і тримається → add чекає → після обох комітів fill дає товару адресу в новій мові', async () => {
    const product = randomUUID();
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
    const product = randomUUID();
    const a = createAddress(product, 'conc-b');
    await until('адреси створено', a.acquired);
    a.release();
    await a.done;
    expect(await pathIn(product, 'cs')).toHaveLength(1);
    expect(await pathIn(product, 'uk')).toHaveLength(1);
  });

  it('add тримає ексклюзивний замок → створення товару чекає й бачить нову мову (замок ДО читання набору)', async () => {
    const product = randomUUID();
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

    // Виклик fill, що будує проєкцію, бере ЕКСКЛЮЗИВНИЙ languages-set і стає в чергу за
    // спільним замком A (фінальне рев'ю М1, N1): адресу в sv A створила сама.
    const fill = fillAll('sv');
    await waitForBlockedTree(db, a, 1, { releaseOnFail: true });
    a.release();
    await Promise.all([a.done, fill]);
    expect(await pathIn(product, 'sv')).toHaveLength(1);
  });

  const tokenIn = (modificationId: string, locale: string) =>
    db.q(
      `select slug from public.slug_tokens where modification_id = $1 and locale = $2 and is_current`,
      [modificationId, locale],
    );
  /** Дзеркало `createAddress` для нової модифікації наявного товару. */
  const createToken = (productId: string, id: string, slug: string) =>
    hold(db, async (d) => {
      await d.execute(sql.raw(freshModificationSql(productId, id, slug)));
      await createTokensForEntity(
        d,
        { kind: 'modification', id, scopeId: productId },
        slug,
      );
    });

  it('токени: A створює токен модифікації під спільним замком → add чекає → fill дає токен у новій мові', async () => {
    const product = await db.product('conc-t1');
    const mod = randomUUID();
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
    const mod = randomUUID();
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
    // Той самий порядок, що для адрес: fill проєкції чекає коміту A.
    const fill = fillAll('no');
    await waitForBlockedTree(db, a, 1, { releaseOnFail: true });
    a.release();
    await Promise.all([a.done, fill]);
    expect(await tokenIn(mod, 'no')).toHaveLength(1);
  });

  // Явна зміна адреси/токена теж бере спільний замок сама (майстер §3.5): стоїть у черзі
  // за ексклюзивним власником. Без замка `waiters` лишається 0 і `until` падає.
  it.each([
    [
      'адреси',
      'es',
      async (productId: string, _mod: string) =>
        hold(db, (d) =>
          setExplicitPath(
            d,
            { kind: 'product', id: productId },
            'uk',
            'expl-p',
          ),
        ),
    ],
    [
      'токена',
      'fi',
      // Модифікація створена ДО утримання ексклюзивного замка: фікстура товару
      // сама бере спільний `languages-set` і стала б у чергу за власником.
      async (productId: string, mod: string) => {
        return hold(db, (d) =>
          setExplicitToken(
            d,
            { kind: 'modification', id: mod, scopeId: productId },
            'uk',
            'expl-t',
          ),
        );
      },
    ],
  ])(
    'явна зміна %s чекає ексклюзивного власника languagesSet',
    async (_what, code, start) => {
      const product = await db.product(`expl-${code}`);
      const mod = await db.modification(product, `expl-m-${code}`);
      const b = hold(db, async (d) => {
        await advisoryXactLock(d, LOCK_KEYS.languagesSet);
        await d
          .insert(languages)
          .values({ id: randomUUID(), code, name: code, status: 'draft' });
      });
      await until('add отримав замок', b.acquired);
      const a = await start(product, mod);
      await until(
        'явна зміна стала в чергу',
        async () => (await waiters(db)) === 1,
      );
      expect(a.acquired()).toBe(false);
      b.release();
      await b.done;
      await until('явна зміна отримала замок', a.acquired);
      a.release();
      await a.done;
    },
  );

  it('disabled → draft чекає творця адреси; творець комітиться без 23514', async () => {
    await addLanguage('ja');
    await fillAll('ja');
    await executeOperation(
      languagesSetStatus,
      { code: 'ja', status: 'disabled' },
      subject,
    );
    const product = randomUUID();
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
    const product = randomUUID();
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

  it('fill чекає ексклюзивний remove і після коміту отримує AdminNotFoundError, а не 23503', async () => {
    await addLanguage('is');
    const r = hold(db, async (d) => {
      await advisoryXactLock(d, LOCK_KEYS.languagesSet);
      await d.delete(languages).where(eq(languages.code, 'is'));
    });
    await until('remove отримав замок і видалив мову', r.acquired);
    const f = executeOperation(languagesFill, { code: 'is' }, subject).catch(
      (e: unknown) => e,
    );
    await until('fill став у чергу', async () => (await waiters(db)) === 1);
    r.release();
    await r.done;
    expect(await f).toBeInstanceOf(AdminNotFoundError);
  });
});
