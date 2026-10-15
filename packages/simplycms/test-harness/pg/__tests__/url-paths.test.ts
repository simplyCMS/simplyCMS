// М1 Task 5 (І15, І16, І18, І19; Review Focus 2): реєстр адрес `url_paths`.
// Генератори ядра ганяються проти живої БД через `withActor`; стан фікстур і
// перевірки — власником; відкладений тригер наявності ловиться на COMMIT сирих
// транзакцій app_admin.
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  PUBLIC_MANIFEST_PATH,
  copyPathsForLocale,
  createPathsForEntity,
  currentPaths,
  resolvePath,
  setExplicitPath,
} from 'simplycms/addressing';
import { overridePublicNamesRootForTests } from '../../../src/addressing/public-names';
import { pathHelpers, useAddressingDb } from './fixtures/addressing-db';
import { hold, sleep, until } from './fixtures/lock-holders';

const CHECK = { code: '23514' };
const UNIQUE = { code: '23505' };

describe('реєстр адрес url_paths (І15, І16, І18, І19)', () => {
  const db = useAddressingDb('simplycms_url_paths');
  const { q, admin, tx } = db;

  const { addr, rows } = pathHelpers(q);

  beforeAll(async () => {
    await db.language('en');
  });

  it('UNIQUE(locale, path)', async () => {
    const [a, b] = [await db.product(), await db.product()];
    await addr('uk', 'uniq-x', a);
    await expect(addr('uk', 'uniq-x', b)).rejects.toMatchObject(UNIQUE);
    await addr('en', 'uniq-x', b); // інша мова — можна
  });

  it('другий поточний для (товар, мова) — unique_violation', async () => {
    const p = await db.product();
    await addr('uk', 'cur-1', p);
    await expect(addr('uk', 'cur-2', p)).rejects.toMatchObject(UNIQUE);
    await addr('uk', 'cur-2', p, false); // історичних може бути багато
  });

  it('num_nonnulls', async () => {
    await expect(addr('uk', 'no-target', null)).rejects.toMatchObject(CHECK);
  });

  it.each(['a/b', 'Upper', 'привіт', 'a--b', '-a', 'a-', 'a b'])(
    'формат шляху: %s — check_violation',
    async (path) => {
      await expect(addr('uk', path, await db.product())).rejects.toMatchObject(
        CHECK,
      );
    },
  );

  it('видалення товару видаляє історію', async () => {
    const p = await db.product();
    await addr('uk', 'hist-now', p);
    await addr('uk', 'hist-old', p, false);
    await q(`delete from public.products where id = $1`, [p]);
    expect(await rows(p)).toEqual([]);
  });

  it('createPathsForEntity: однакова назва → -2, -3', async () => {
    const ids = [await db.product(), await db.product(), await db.product()];
    const got = [];
    for (const id of ids)
      got.push(
        await admin((d) =>
          createPathsForEntity(d, { kind: 'product', id }, 'panel'),
        ),
      );
    expect(got.map((m) => m.get('uk'))).toEqual([
      'panel',
      'panel-2',
      'panel-3',
    ]);
    expect(got.map((m) => m.get('en'))).toEqual([
      'panel',
      'panel-2',
      'panel-3',
    ]);
  });

  it('createPathsForEntity: зарезервоване й код мови не стають адресою', async () => {
    const p = await db.product();
    const got = await admin((d) =>
      createPathsForEntity(d, { kind: 'product', id: p }, 'cart'),
    );
    expect(got.get('uk')).toBe('cart-2');
    const e = await db.product();
    const en = await admin((d) =>
      createPathsForEntity(d, { kind: 'product', id: e }, 'en'),
    );
    expect(en.get('uk')).toBe('en-2');
  });

  describe('setExplicitPath', () => {
    it('гонка: той самий новий шлях з двох транзакцій → другий path_taken (23505 з .cause)', async () => {
      const [a, b] = [await db.product(), await db.product()];
      const first = hold(db, (d) =>
        setExplicitPath(d, { kind: 'product', id: a }, 'uk', 'race-x'),
      );
      await until('A вставила шлях', first.acquired);
      // B не бачить незакомічений рядок A: передперевірка проходить, а вставка
      // чекає на унікальний індекс і падає 23505 після коміту A.
      const second = admin((d) =>
        setExplicitPath(d, { kind: 'product', id: b }, 'uk', 'race-x'),
      ).catch((e: unknown) => e);
      await sleep(300);
      first.release();
      await first.done;
      expect(await second).toMatchObject({
        kind: 'unique',
        constraint: 'path_taken',
      });
    });

    it('на чужий історичний або поточний → path_taken', async () => {
      const [a, b] = [await db.product(), await db.product()];
      await addr('uk', 'own-a', a);
      await addr('uk', 'old-a', a, false);
      for (const taken of ['old-a', 'own-a'])
        await expect(
          admin((d) =>
            setExplicitPath(d, { kind: 'product', id: b }, 'uk', taken),
          ),
        ).rejects.toMatchObject({
          name: 'AdminConflictError',
          constraint: 'path_taken',
        });
    });

    it('на власний історичний → він поточний, колишній — історія', async () => {
      const p = await db.product();
      await addr('uk', 'back-new', p);
      await addr('uk', 'back-old', p, false);
      await admin((d) =>
        setExplicitPath(d, { kind: 'product', id: p }, 'uk', 'back-old'),
      );
      expect(await rows(p)).toEqual([
        { locale: 'uk', path: 'back-old', is_current: true },
        { locale: 'uk', path: 'back-new', is_current: false },
      ]);
    });

    it('нова вільна адреса: стара йде в історію, resolve дає currentPath', async () => {
      const p = await db.product();
      await addr('uk', 'free-old', p);
      await admin((d) =>
        setExplicitPath(d, { kind: 'product', id: p }, 'uk', 'free-new'),
      );
      const target = { kind: 'product', id: p };
      expect(await admin((d) => resolvePath(d, 'uk', 'free-old'))).toEqual({
        target,
        currentPath: 'free-new',
        isCurrent: false,
      });
      expect(
        (await admin((d) => resolvePath(d, 'uk', 'free-new')))?.isCurrent,
      ).toBe(true);
      expect(await admin((d) => resolvePath(d, 'uk', 'nope-x'))).toBeNull();
      expect(
        await admin((d) => currentPaths(d, { kind: 'product', id: p })),
      ).toEqual(new Map([['uk', 'free-new']]));
    });

    it.each(['cart', 'admin', 'assets', 'uk', 'en'])(
      'зарезервований сегмент і код мови (%s) → reserved (І19)',
      async (path) => {
        const p = await db.product();
        await addr('uk', `res-${path}`, p);
        await expect(
          admin((d) =>
            setExplicitPath(d, { kind: 'product', id: p }, 'uk', path),
          ),
        ).rejects.toMatchObject({
          name: 'ValidationError',
          issues: [{ path: ['path'], code: 'reserved' }],
        });
      },
    );

    it.each(['sitemap.xml', 'robots.txt', 'Cart', 'a b'])(
      'не slug (%s) → invalid_format, а не reserved',
      async (path) => {
        const p = await db.product();
        await addr('uk', `fmt-${randomUUID().slice(0, 8)}`, p);
        await expect(
          admin((d) =>
            setExplicitPath(d, { kind: 'product', id: p }, 'uk', path),
          ),
        ).rejects.toMatchObject({
          name: 'ValidationError',
          issues: [{ path: ['path'], code: 'invalid_format' }],
        });
      },
    );

    it('імена з public/ збірки (маніфест) → reserved; генератор обходить їх суфіксом', async () => {
      const root = mkdtempSync(join(tmpdir(), 'scms-public-'));
      mkdirSync(join(root, 'dist/client'), { recursive: true });
      writeFileSync(
        join(root, PUBLIC_MANIFEST_PATH),
        JSON.stringify(['robots-custom', 'favicon']),
      );
      const restore = overridePublicNamesRootForTests(root);
      try {
        const p = await db.product();
        await addr('uk', 'pub-own', p);
        await expect(
          admin((d) =>
            setExplicitPath(
              d,
              { kind: 'product', id: p },
              'uk',
              'robots-custom',
            ),
          ),
        ).rejects.toMatchObject({
          issues: [{ path: ['path'], code: 'reserved' }],
        });
        const q2 = await db.product();
        const got = await admin((d) =>
          createPathsForEntity(d, { kind: 'product', id: q2 }, 'favicon'),
        );
        expect(got.get('uk')).toBe('favicon-2');
      } finally {
        restore();
        rmSync(root, { recursive: true, force: true });
      }
    });
  });

  describe('відкладена наявність поточної адреси (К4, тригер реєстру)', () => {
    it('видалення поточної адреси без заміни — відмова на коміті; заміна в тій самій транзакції — коміт', async () => {
      const p = await db.product();
      await addr('uk', 'trg-a', p);
      await expect(
        tx(`delete from public.url_paths where product_id = '${p}'`),
      ).rejects.toMatchObject(CHECK);
      await tx(
        `update public.url_paths set is_current = false where product_id = '${p}'`,
        `insert into public.url_paths (id, locale, path, product_id, is_current)
         values (gen_random_uuid(), 'uk', 'trg-b', '${p}', true)`,
      );
      expect((await rows(p)).map((r) => r.path)).toEqual(['trg-b', 'trg-a']);
    });

    it('перенесення поточної адреси в іншу мову — відмова', async () => {
      await db.language('hu', 'draft');
      const p = await db.product();
      await addr('uk', 'move-a', p);
      await expect(
        tx(
          `update public.url_paths set locale = 'hu' where product_id = '${p}'`,
        ),
      ).rejects.toMatchObject(CHECK);
    });

    it('видалення мови draft з адресами в кількох товарів (каскад) — коміт', async () => {
      await db.language('de', 'draft');
      for (let i = 0; i < 3; i += 1) {
        const p = await db.product();
        await addr('uk', `lang-del-${i}`, p);
        await addr('de', `lang-del-${i}`, p);
      }
      await tx(`delete from public.languages where code = 'de'`);
      expect(
        await q(`select 1 from public.url_paths where locale = 'de'`),
      ).toEqual([]);
    });

    it('видалення товару з адресами (каскад) — коміт', async () => {
      const p = await db.product();
      await addr('uk', 'prod-del', p);
      await addr('en', 'prod-del', p);
      await tx(`delete from public.products where id = '${p}'`);
      expect(await rows(p)).toEqual([]);
    });

    it('вимкнення мови (disabled) не чіпає її адрес і комітиться; видалення адреси disabled-мови — коміт', async () => {
      await db.language('fr');
      const p = await db.product();
      await addr('uk', 'dis-a', p);
      await addr('fr', 'dis-a', p);
      await tx(
        `update public.languages set status = 'disabled' where code = 'fr'`,
      );
      expect((await rows(p)).filter((r) => r.locale === 'fr')).toHaveLength(1);
      await tx(
        `delete from public.url_paths where product_id = '${p}' and locale = 'fr'`,
      );
      expect((await rows(p)).filter((r) => r.locale === 'fr')).toHaveLength(0);
    });
  });

  // М1-TEMP: Task 17 — тригер бази вмикається, очікування стає 'O'.
  it('стан тригерів: база вимкнена (D), реєстр увімкнений (O)', async () => {
    const got = await q(
      `select tgname, tgenabled from pg_trigger
        where tgname in ('products_cur_addr_b', 'url_paths_cur_addr_r') order by tgname`,
    );
    expect(got).toEqual([
      { tgname: 'products_cur_addr_b', tgenabled: 'D' },
      { tgname: 'url_paths_cur_addr_r', tgenabled: 'O' },
    ]);
  });
});

// Кожен кейс копіювання — у власній БД: точна кількість скопійованих рядків не
// залежить від товарів інших кейсів.
describe('copyPathsForLocale: ізольовано (Review Focus 2)', () => {
  const db = useAddressingDb('simplycms_copy_paths_a');
  const { addr, rows } = pathHelpers(db.q);
  const own = async (id: string, locale: string) =>
    (await rows(id)).filter((r) => r.locale === locale);

  it('копія зайнята історією → суфікс; повторний виклик вставляє 0', async () => {
    await db.language('cs', 'draft');
    const [x, z] = [await db.product(), await db.product()];
    await addr('uk', 'copy-x', x);
    await addr('uk', 'copy-z', z);
    // Мова cs уже має товар Z з поточною адресою й історичним рядком, що займає copy-x.
    await addr('cs', 'copy-z', z);
    await addr('cs', 'copy-x', z, false);
    expect(await db.admin((d) => copyPathsForLocale(d, 'cs', 100))).toBe(1);
    expect(await own(x, 'cs')).toEqual([
      { locale: 'cs', path: 'copy-x-2', is_current: true },
    ]);
    expect(await own(z, 'cs')).toHaveLength(2); // власні рядки Z не чіпано
    expect(await db.admin((d) => copyPathsForLocale(d, 'cs', 100))).toBe(0);
  });
});

describe('copyPathsForLocale: пакет з колізією', () => {
  const db = useAddressingDb('simplycms_copy_paths_b');
  const { addr, rows } = pathHelpers(db.q);

  it('товари пакета з однаковою базою в новій мові не отримують однаковий slug', async () => {
    await db.language('pl', 'draft');
    const [a, b] = [await db.product(), await db.product()];
    await addr('uk', 'batch-a', a);
    await addr('uk', 'batch-a-2', b);
    // batch-a зайнятий історією іншого товару: a → batch-a-2, і b мусить піти далі.
    const other = await db.product();
    await addr('pl', 'batch-a', other, false);
    await addr('pl', 'other-now', other);
    expect(await db.admin((d) => copyPathsForLocale(d, 'pl', 100))).toBe(2);
    const pl = async (id: string) =>
      (await rows(id)).filter((r) => r.locale === 'pl').map((r) => r.path);
    expect(await pl(a)).toEqual(['batch-a-2']);
    expect(await pl(b)).toEqual(['batch-a-2-2']);
  });
});

describe('copyPathsForLocale: limit', () => {
  const db = useAddressingDb('simplycms_copy_paths_c');
  const { addr } = pathHelpers(db.q);

  it('limit обмежує пакет; пакети продовжують до 0', async () => {
    await db.language('sk', 'draft');
    for (let i = 0; i < 3; i += 1)
      await addr('uk', `lim-${i}`, await db.product());
    const run = () => db.admin((d) => copyPathsForLocale(d, 'sk', 2));
    expect([await run(), await run(), await run()]).toEqual([2, 1, 0]);
  });
});

describe('copyPathsForLocale: імена з public/ збірки', () => {
  const db = useAddressingDb('simplycms_copy_paths_d');
  const { addr, rows } = pathHelpers(db.q);

  it('копія, що збіглася б з іменем у public/, отримує суфікс', async () => {
    const root = mkdtempSync(join(tmpdir(), 'scms-public-copy-'));
    mkdirSync(join(root, 'dist/client'), { recursive: true });
    writeFileSync(
      join(root, PUBLIC_MANIFEST_PATH),
      JSON.stringify(['pub-copy']),
    );
    const restore = overridePublicNamesRootForTests(root);
    try {
      await db.language('hu', 'draft');
      const p = await db.product();
      await addr('uk', 'pub-copy', p);
      expect(await db.admin((d) => copyPathsForLocale(d, 'hu', 100))).toBe(1);
      expect((await rows(p)).filter((r) => r.locale === 'hu')).toEqual([
        { locale: 'hu', path: 'pub-copy-2', is_current: true },
      ]);
    } finally {
      restore();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
