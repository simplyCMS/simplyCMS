// М1 (майстер §3.5): запис у реєстри адрес і токенів — лише під замком `languages-set`
// (спільним АБО ексклюзивним). Правило тримає тригер БД, як `languages_require_lock` (SC001).
// Товар і модифікація фікстур уже мають поточні адреси й токени (тригер наявності, І16),
// тож перевірочні рядки — історичні: замок не залежить від `is_current`.
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { advisoryXactLock, advisoryXactLockShared } from 'simplycms/db';
import { LOCK_KEYS } from 'simplycms/db/lock-keys';
import { useAddressingDb } from './fixtures/addressing-db';
import { slugTokenRowSql, urlPathRowSql } from './fixtures/product-graph';

const NO_LOCK = { cause: { code: 'SC004' } };

describe('addresses_require_languages_lock: запис в url_paths і slug_tokens без замка відмовляє', () => {
  const db = useAddressingDb('simplycms_address_lock');
  const path = (productId: string, p: string) =>
    sql.raw(
      urlPathRowSql({ locale: 'uk', path: p, productId, isCurrent: false }),
    );
  const token = (productId: string, modId: string, slug: string) =>
    sql.raw(
      slugTokenRowSql({
        locale: 'uk',
        scopeId: productId,
        slug,
        modificationId: modId,
        isCurrent: false,
      }),
    );

  it('INSERT і UPDATE url_paths без замка → SC004', async () => {
    const product = await db.product('al-p1');
    await expect(
      db.admin((d) => d.execute(path(product, 'al-p1-h'))),
    ).rejects.toMatchObject(NO_LOCK);
    await db.admin(async (d) => {
      await advisoryXactLockShared(d, LOCK_KEYS.languagesSet);
      await d.execute(path(product, 'al-p1-h'));
    });
    await expect(
      db.admin((d) =>
        d.execute(
          sql`update public.url_paths set is_current = false where path = 'al-p1-h'`,
        ),
      ),
    ).rejects.toMatchObject(NO_LOCK);
  });

  it('INSERT і UPDATE slug_tokens без замка → SC004', async () => {
    const product = await db.product('al-p2');
    const mod = await db.modification(product, 'al-m2');
    await expect(
      db.admin((d) => d.execute(token(product, mod, 'al-t2'))),
    ).rejects.toMatchObject(NO_LOCK);
    await db.admin(async (d) => {
      await advisoryXactLockShared(d, LOCK_KEYS.languagesSet);
      await d.execute(token(product, mod, 'al-t2'));
    });
    await expect(
      db.admin((d) =>
        d.execute(
          sql`update public.slug_tokens set is_current = false where slug = 'al-t2'`,
        ),
      ),
    ).rejects.toMatchObject(NO_LOCK);
  });

  it('спільний замок пускає запис в обидва реєстри', async () => {
    const product = await db.product('al-p3');
    const mod = await db.modification(product, 'al-m3');
    await db.admin(async (d) => {
      await advisoryXactLockShared(d, LOCK_KEYS.languagesSet);
      await d.execute(path(product, 'al-p3-h'));
      await d.execute(token(product, mod, 'al-t3'));
      await d.execute(
        sql`update public.url_paths set is_current = false where path = 'al-p3-h'`,
      );
    });
    expect(
      await db.q(`select 1 from public.url_paths where path = 'al-p3-h'`),
    ).toHaveLength(1);
  });

  it('ексклюзивний замок пускає запис в обидва реєстри', async () => {
    const product = await db.product('al-p4');
    const mod = await db.modification(product, 'al-m4');
    await db.admin(async (d) => {
      await advisoryXactLock(d, LOCK_KEYS.languagesSet);
      await d.execute(path(product, 'al-p4-h'));
      await d.execute(token(product, mod, 'al-t4'));
    });
    expect(
      await db.q(`select 1 from public.slug_tokens where slug = 'al-t4'`),
    ).toHaveLength(1);
  });

  it('чужий замок не годиться, DELETE не охоплено (каскад товару йде через RI)', async () => {
    const product = await db.product('al-p5');
    await expect(
      db.admin(async (d) => {
        await advisoryXactLockShared(d, 'languages-set-other');
        await d.execute(path(product, 'al-p5-old'));
      }),
    ).rejects.toMatchObject(NO_LOCK);
    await db.admin(async (d) => {
      await advisoryXactLockShared(d, LOCK_KEYS.languagesSet);
      await d.execute(path(product, 'al-p5-old'));
    });
    // Історичну адресу прибирає DELETE без замка: тригер на нього не реагує.
    await db.admin((d) =>
      d.execute(sql`delete from public.url_paths where path = 'al-p5-old'`),
    );
    expect(
      await db.q(`select 1 from public.url_paths where path = 'al-p5-old'`),
    ).toHaveLength(0);
  });
});
