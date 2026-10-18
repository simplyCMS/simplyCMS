// М1 Task 6: операції мов проти живого Postgres (виконавець без HTTP).
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  AdminNotFoundError,
  InUseError,
  ValidationError,
} from 'simplycms/contracts/domain-errors';
import {
  languagesAdd,
  languagesFill,
  languagesList,
  languagesRemove,
  languagesReorder,
  languagesSetStatus,
} from 'simplycms/admin-server/impl';
import { executeOperation } from 'simplycms/operations';
import type { OperationDef } from 'simplycms/operations';
import { LANGUAGES_LOCK_SQL } from '../apply.mjs';
import { ADMIN, useAddressingDb } from './fixtures/addressing-db';

const subject = { userId: ADMIN.userId, roles: ['admin' as const] };

describe('операції мов (M1, Task 6)', () => {
  const db = useAddressingDb('simplycms_languages_operations');
  const exec = async <I, O>(def: OperationDef<I, O>, raw: unknown) => {
    const res = await executeOperation(def, raw, subject);
    if (res.replayed) throw new Error('replay');
    return res.output;
  };
  const add = (code: string) =>
    exec(languagesAdd, { id: randomUUID(), code, name: code });
  const fillAll = async (code: string) => {
    for (let i = 0; i < 50; i += 1)
      if ((await exec(languagesFill, { code, batch: 2 })).done) return;
    throw new Error('fill не завершився');
  };
  const stat = async (code: string) =>
    (
      await db.q(`select status from public.languages where code = $1`, [code])
    )[0]?.status;
  /** Товар графа з поточною адресою основної мови (`insertProductGraph`, Task 10). */
  const seedProduct = (slug: string) => db.product(slug);
  const pathCount = async (locale: string) =>
    Number(
      (
        await db.q(
          `select count(*)::int n from public.url_paths where locale = $1`,
          [locale],
        )
      )[0]?.n,
    );

  it('add → draft, fill створює адреси для всіх товарів', async () => {
    const ids = [
      await seedProduct('a-1'),
      await seedProduct('a-2'),
      await seedProduct('a-3'),
    ];
    const created = await add('pl');
    expect(created).toMatchObject({
      code: 'pl',
      status: 'draft',
      hasPack: false,
    });
    await fillAll('pl');
    for (const id of ids) {
      const rows = await db.q(
        `select path from public.url_paths where product_id = $1 and locale = 'pl' and is_current`,
        [id],
      );
      expect(rows).toHaveLength(1);
    }
    const list = await exec(languagesList, {});
    expect(list.map((l) => l.code)).toEqual(['uk', 'pl']);
    expect(list[0]).toMatchObject({
      code: 'uk',
      isDefault: true,
      hasPack: true,
    });
  });

  it('published без повноти → language_incomplete', async () => {
    await seedProduct('b-1');
    await add('cs');
    const err = await exec(languagesSetStatus, {
      code: 'cs',
      status: 'published',
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).issues).toEqual([
      { path: ['status'], code: 'language_incomplete' },
    ]);
    expect(await stat('cs')).toBe('draft');
  });

  it('після fill до done → published', async () => {
    await seedProduct('c-1');
    await add('de');
    await fillAll('de');
    expect(
      await exec(languagesSetStatus, { code: 'de', status: 'published' }),
    ).toMatchObject({ status: 'published' });
  });

  it('disabled → published дозаповнює адреси товарів, створених поки мова disabled', async () => {
    await add('sk');
    await fillAll('sk');
    await exec(languagesSetStatus, { code: 'sk', status: 'disabled' });
    const late = await seedProduct('d-late');
    // Мова disabled: генератор адрес її не бачить, тож адреси немає.
    expect(
      await exec(languagesSetStatus, { code: 'sk', status: 'published' }).catch(
        (e: unknown) => e,
      ),
    ).toBeInstanceOf(ValidationError);
    await fillAll('sk');
    const rows = await db.q(
      `select 1 from public.url_paths where product_id = $1 and locale = 'sk' and is_current`,
      [late],
    );
    expect(rows).toHaveLength(1);
    expect(
      await exec(languagesSetStatus, { code: 'sk', status: 'published' }),
    ).toMatchObject({ status: 'published' });
  });

  it('недозволені переходи й основна мова → ValidationError', async () => {
    await expect(
      exec(languagesSetStatus, { code: 'uk', status: 'disabled' }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      exec(languagesSetStatus, { code: 'de', status: 'draft' }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      exec(languagesSetStatus, { code: 'zz', status: 'disabled' }),
    ).rejects.toBeInstanceOf(AdminNotFoundError);
  });

  it('reorder задає порядок цілого набору й відхиляє дубль чи неповний список', async () => {
    const codes = (await exec(languagesList, {})).map((l) => l.code).reverse();
    const list = await exec(languagesReorder, { codes });
    expect(list.map((l) => l.code)).toEqual(codes);
    await expect(
      exec(languagesReorder, { codes: ['uk', 'uk'] }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      exec(languagesReorder, { codes: ['uk'] }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('remove мови без перекладів — ок, адреси каскадом', async () => {
    await seedProduct('e-1');
    await add('hu');
    await fillAll('hu');
    expect(await pathCount('hu')).toBeGreaterThan(0);
    await exec(languagesRemove, { code: 'hu' });
    expect(await pathCount('hu')).toBe(0);
    expect(await stat('hu')).toBeUndefined();
  });

  // Справжній споживач мови: `product_translations.locale → languages(code) ON DELETE
  // RESTRICT` (М2 додасть замовлення тощо).
  it('переклад товару мовою L → remove L → 409 language_in_use', async () => {
    await add('fi');
    const productId = await seedProduct('g-1');
    await db.q(
      `insert into public.product_translations (product_id, locale, name)
       values ($1, 'fi', 'Tuote')`,
      [productId],
    );
    const err = await exec(languagesRemove, { code: 'fi' }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(InUseError);
    expect((err as InUseError).kind).toBe('language_in_use');
    expect(await stat('fi')).toBe('draft');
    // Без перекладу мова знову вільна: доказ, що відмову давав саме FK перекладу.
    await db.q(`delete from public.product_translations where locale = 'fi'`);
    await exec(languagesRemove, { code: 'fi' });
    expect(await stat('fi')).toBeUndefined();
  });

  it('remove draft-мови з адресами й токенами товарів → коміт', async () => {
    const p = await seedProduct('f-1');
    await db.modification(p, 'red');
    await add('ro');
    await fillAll('ro');
    expect(
      await db.q(`select 1 from public.slug_tokens where locale = 'ro'`),
    ).toHaveLength(1);
    await exec(languagesRemove, { code: 'ro' });
    expect(
      await db.q(`select 1 from public.slug_tokens where locale = 'ro'`),
    ).toHaveLength(0);
  });

  it('remove основної → доменна відмова (тригер лишається страховкою)', async () => {
    const err = await exec(languagesRemove, { code: 'uk' }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).issues).toEqual([
      { path: ['code'], code: 'invalid_value' },
    ]);
    // Доказ тригера: пряме видалення основної мимо операції все одно відмовляє.
    await expect(
      db.tx(
        LANGUAGES_LOCK_SQL,
        `delete from public.languages where is_default`,
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('setStatus, reorder і remove піднімають покоління кешу мов', async () => {
    const gen = async () =>
      Number(
        (
          await db.q(
            `select generation from public.cache_generations where key = 'languages'`,
          )
        )[0]?.generation,
      );
    await add('el');
    let before = await gen();
    await exec(languagesSetStatus, { code: 'el', status: 'disabled' });
    expect(await gen()).toBe(before + 1);
    before = await gen();
    const codes = (await exec(languagesList, {})).map((l) => l.code);
    await exec(languagesReorder, { codes });
    expect(await gen()).toBe(before + 1);
    before = await gen();
    await exec(languagesRemove, { code: 'el' });
    expect(await gen()).toBe(before + 1);
  });
});
