// М1 Task 5 (І21; К2; Review Focus 2): реєстр мовних токенів `slug_tokens`.
// Дзеркало url-paths.test.ts для простору (locale, token_kind, scope_id).
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  copyTokensForLocale,
  createTokensForEntity,
  resolveToken,
  setExplicitToken,
} from 'simplycms/addressing';
import { tokenHelpers, useAddressingDb } from './fixtures/addressing-db';
import { LANGUAGES_LOCK_SQL } from '../apply.mjs';

const CHECK = { code: '23514' };
const UNIQUE = { code: '23505' };
const FK = { code: '23503' };

describe('реєстр мовних токенів slug_tokens (І21)', () => {
  const db = useAddressingDb('simplycms_slug_tokens');
  const { q, admin, tx } = db;

  /**
   * Товар + модифікація з поточним токеном `slug` у кожній мові draft/published:
   * модифікації без токена не буває (тригер наявності на базі, І16).
   */
  const mod = async (slug?: string) => {
    const productId = await db.product();
    const id = await db.modification(productId, slug);
    return { kind: 'modification' as const, id, scopeId: productId };
  };
  const { tok, rows } = tokenHelpers(db);
  const uk = async (id: string) =>
    (await rows(id)).filter((r) => r.locale === 'uk');

  beforeAll(async () => {
    await db.language('en');
  });

  it('UNIQUE(locale, token_kind, scope_id, slug) включно з історією; однаковий slug у різних товарів дозволений', async () => {
    const a = await mod('red');
    await mod('red'); // інший товар — інша область
    await expect(db.modification(a.scopeId, 'red')).rejects.toMatchObject(
      UNIQUE,
    );
    await tok('uk', 'old', a, false);
    const a3 = await db.modification(a.scopeId);
    await expect(
      tok('uk', 'old', { id: a3, scopeId: a.scopeId }, false),
    ).rejects.toMatchObject(UNIQUE);
  });

  it('другий поточний для (модифікація, мова) — unique_violation', async () => {
    const t = await mod('one');
    await expect(tok('uk', 'two', t)).rejects.toMatchObject(UNIQUE);
  });

  it('складений FK відхиляє модифікацію чужого товару', async () => {
    const [a, b] = [await mod(), await mod()];
    await expect(
      tok('uk', 'cross', { id: a.id, scopeId: b.scopeId }, false),
    ).rejects.toMatchObject(FK);
  });

  it('токен модифікації з scope_id IS NULL → check_violation (К2)', async () => {
    const t = await mod();
    await expect(
      tok('uk', 'no-scope', { id: t.id, scopeId: null }, false),
    ).rejects.toMatchObject(CHECK);
  });

  it('num_nonnulls і формат slug', async () => {
    const t = await mod();
    await expect(
      db.w(
        `insert into public.slug_tokens (id, locale, scope_id, slug, is_current)
         values (gen_random_uuid(), 'uk', $1, 'x', true)`,
        [t.scopeId],
      ),
    ).rejects.toMatchObject(CHECK);
    for (const bad of ['Upper', 'a/b', 'привіт', 'a--b'])
      await expect(tok('uk', bad, t, false)).rejects.toMatchObject(CHECK);
  });

  it('token_kind згенерований і входить у ключ унікальності (різні види не конфліктують)', async () => {
    const t = await mod('kind-a');
    expect(
      await q(
        `select distinct token_kind from public.slug_tokens where modification_id = $1`,
        [t.id],
      ),
    ).toEqual([{ token_kind: 'modification' }]);
    const key = await q(
      `select pg_get_constraintdef(oid) as def from pg_constraint
        where conname = 'slug_tokens_scope_slug_key'`,
    );
    expect(key[0].def).toBe(
      'UNIQUE NULLS NOT DISTINCT (locale, token_kind, scope_id, slug)',
    );
  });

  it('видалення модифікації й товару видаляє токени', async () => {
    const t = await mod('del-a');
    await q(`delete from public.products where id = $1`, [t.scopeId]);
    expect(await rows(t.id)).toEqual([]);
  });

  it('createTokensForEntity: однаковий slug в одному товарі → -2, -3; у різних товарів без суфікса', async () => {
    const productId = await db.product();
    const got = [];
    // Нова модифікація і її токени — одна транзакція, як у команді агрегата.
    for (let i = 0; i < 3; i += 1)
      got.push(
        await db.freshModification(productId, (d, id) =>
          createTokensForEntity(
            d,
            { kind: 'modification', id, scopeId: productId },
            'red',
          ),
        ),
      );
    expect(got.map((m) => m.get('uk'))).toEqual(['red', 'red-2', 'red-3']);
    expect(got.map((m) => m.get('en'))).toEqual(['red', 'red-2', 'red-3']);
    const other = await db.product();
    const first = await db.freshModification(other, (d, id) =>
      createTokensForEntity(
        d,
        { kind: 'modification', id, scopeId: other },
        'red',
      ),
    );
    expect(first.get('uk')).toBe('red');
  });

  describe('setExplicitToken', () => {
    it.each(['Upper', 'a/b', 'привіт', 'a--b'])(
      'не slug (%s) → invalid_format',
      async (slug) => {
        const t = await mod(`fmt-${randomUUID().slice(0, 8)}`);
        await expect(
          admin((d) => setExplicitToken(d, t, 'uk', slug)),
        ).rejects.toMatchObject({
          name: 'ValidationError',
          issues: [{ path: ['slug'], code: 'invalid_format' }],
        });
      },
    );

    it('на чужий історичний або поточний → slug_taken', async () => {
      const productId = await db.product();
      const a = {
        id: await db.modification(productId, 'cur-a'),
        scopeId: productId,
      };
      const b = { id: await db.modification(productId), scopeId: productId };
      await tok('uk', 'old-a', a, false);
      for (const taken of ['old-a', 'cur-a'])
        await expect(
          admin((d) =>
            setExplicitToken(d, { kind: 'modification', ...b }, 'uk', taken),
          ),
        ).rejects.toMatchObject({
          name: 'AdminConflictError',
          constraint: 'slug_taken',
        });
    });

    it('на власний історичний → він поточний, колишній — історія; resolveToken', async () => {
      const t = await mod('back-new');
      await tok('uk', 'back-old', t, false);
      await admin((d) => setExplicitToken(d, t, 'uk', 'back-old'));
      expect(await uk(t.id)).toEqual([
        { locale: 'uk', slug: 'back-old', is_current: true },
        { locale: 'uk', slug: 'back-new', is_current: false },
      ]);
      expect(
        await admin((d) => resolveToken(d, 'uk', t.scopeId, 'back-new')),
      ).toEqual({
        target: t,
        currentSlug: 'back-old',
        isCurrent: false,
      });
      expect(
        await admin((d) => resolveToken(d, 'uk', t.scopeId, 'zzz')),
      ).toBeNull();
    });
  });

  describe('відкладена наявність поточного токена (К4, тригер реєстру)', () => {
    it('видалення поточного токена без заміни — відмова на коміті; заміна в тій самій транзакції — коміт', async () => {
      const t = await mod('trg-a');
      const ukRows = `modification_id = '${t.id}' and locale = 'uk'`;
      await expect(
        tx(`delete from public.slug_tokens where ${ukRows}`),
      ).rejects.toMatchObject(CHECK);
      await tx(
        `update public.slug_tokens set is_current = false where ${ukRows}`,
        `insert into public.slug_tokens (id, locale, scope_id, slug, modification_id, is_current)
         values (gen_random_uuid(), 'uk', '${t.scopeId}', 'trg-b', '${t.id}', true)`,
      );
      expect((await uk(t.id)).map((r) => r.slug)).toEqual(['trg-b', 'trg-a']);
    });

    it('видалення мови draft з токенами в кількох модифікацій (каскад) — коміт', async () => {
      await db.language('de', 'draft');
      for (let i = 0; i < 3; i += 1) await mod(`lang-del-${i}`);
      await tx(
        LANGUAGES_LOCK_SQL,
        `delete from public.languages where code = 'de'`,
      );
      expect(
        await q(`select 1 from public.slug_tokens where locale = 'de'`),
      ).toEqual([]);
    });

    it('видалення модифікації з токенами (каскад) — коміт', async () => {
      const t = await mod('mod-del');
      await tx(`delete from public.product_modifications where id = '${t.id}'`);
      expect(await rows(t.id)).toEqual([]);
    });

    it('вимкнення мови (disabled) не чіпає її токенів; видалення токена disabled-мови — коміт', async () => {
      await db.language('fr');
      const t = await mod('dis-a');
      await tx(
        LANGUAGES_LOCK_SQL,
        `update public.languages set status = 'disabled' where code = 'fr'`,
      );
      expect((await rows(t.id)).filter((r) => r.locale === 'fr')).toHaveLength(
        1,
      );
      await tx(
        `delete from public.slug_tokens where modification_id = '${t.id}' and locale = 'fr'`,
      );
      expect((await rows(t.id)).filter((r) => r.locale === 'fr')).toHaveLength(
        0,
      );
    });
  });

  it('стан тригерів: база й реєстр увімкнені (O)', async () => {
    const got = await q(
      `select tgname, tgenabled from pg_trigger
        where tgname in ('product_modifications_cur_tok_b', 'slug_tokens_cur_tok_r') order by tgname`,
    );
    expect(got).toEqual([
      { tgname: 'product_modifications_cur_tok_b', tgenabled: 'O' },
      { tgname: 'slug_tokens_cur_tok_r', tgenabled: 'O' },
    ]);
  });
});

describe('copyTokensForLocale: ізольовано', () => {
  const db = useAddressingDb('simplycms_copy_tokens_a');
  const { tok, rows } = tokenHelpers(db);

  it('копія зайнята історією → суфікс; повторний виклик вставляє 0', async () => {
    // Модифікації — до мови: у новій мові токенів ще немає, їх і дає копіювання.
    const productId = await db.product();
    const [x, z] = [
      await db.modification(productId, 'copy-x'),
      await db.modification(productId, 'copy-z'),
    ];
    const sz = { id: z, scopeId: productId };
    await db.language('cs', 'draft');
    await tok('cs', 'copy-z', sz);
    await tok('cs', 'copy-x', sz, false);
    expect(await db.shared((d) => copyTokensForLocale(d, 'cs', 100))).toBe(1);
    expect((await rows(x)).filter((r) => r.locale === 'cs')).toEqual([
      { locale: 'cs', slug: 'copy-x-2', is_current: true },
    ]);
    expect(await db.shared((d) => copyTokensForLocale(d, 'cs', 100))).toBe(0);
  });
});

describe('copyTokensForLocale: пакет з колізією', () => {
  const db = useAddressingDb('simplycms_copy_tokens_b');
  const { tok, rows } = tokenHelpers(db);

  it('модифікації пакета з колізією в новій мові не отримують однаковий slug', async () => {
    const productId = await db.product();
    const [a, b, other] = [
      await db.modification(productId, 'batch-a'),
      await db.modification(productId, 'batch-a-2'),
      await db.modification(productId, 'batch-other'),
    ];
    await db.language('pl', 'draft');
    await tok('pl', 'batch-a', { id: other, scopeId: productId }, false);
    await tok('pl', 'other-now', { id: other, scopeId: productId });
    expect(await db.shared((d) => copyTokensForLocale(d, 'pl', 100))).toBe(2);
    const pl = async (id: string) =>
      (await rows(id)).filter((r) => r.locale === 'pl').map((r) => r.slug);
    expect(await pl(a)).toEqual(['batch-a-2']);
    expect(await pl(b)).toEqual(['batch-a-2-2']);
  });
});
