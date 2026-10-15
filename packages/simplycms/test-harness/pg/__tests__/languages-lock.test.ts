// М1 Task 6 (І16): запис у `languages` — лише під ексклюзивним замком
// `languages-set`; правило тримає тригер БД `languages_require_lock`.
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { advisoryXactLock, advisoryXactLockShared } from 'simplycms/db';
import { LOCK_KEYS } from 'simplycms/db/lock-keys';
import { useAddressingDb } from './fixtures/addressing-db';

const NO_LOCK = { cause: { code: 'SC001' } };

describe('languages_require_lock: запис без замка відмовляє', () => {
  const db = useAddressingDb('simplycms_languages_lock');
  const insert = (code: string) =>
    sql`insert into public.languages (id, code, name, status, is_default, sort_order)
        values (${randomUUID()}::uuid, ${code}, ${code}, 'draft', false, 7)`;

  it('INSERT, UPDATE і DELETE без замка → SC001', async () => {
    await db.language('lk');
    await expect(
      db.admin((d) => d.execute(insert('lx'))),
    ).rejects.toMatchObject(NO_LOCK);
    await expect(
      db.admin((d) =>
        d.execute(
          sql`update public.languages set name = 'n' where code = 'lk'`,
        ),
      ),
    ).rejects.toMatchObject(NO_LOCK);
    await expect(
      db.admin((d) =>
        d.execute(sql`delete from public.languages where code = 'lk'`),
      ),
    ).rejects.toMatchObject(NO_LOCK);
  });

  it('спільний замок не дає права запису', async () => {
    await expect(
      db.admin(async (d) => {
        await advisoryXactLockShared(d, LOCK_KEYS.languagesSet);
        await d.execute(insert('ly'));
      }),
    ).rejects.toMatchObject(NO_LOCK);
  });

  it('чужий ексклюзивний замок не годиться', async () => {
    await expect(
      db.admin(async (d) => {
        await advisoryXactLock(d, 'languages-set-other');
        await d.execute(insert('lz'));
      }),
    ).rejects.toMatchObject(NO_LOCK);
  });

  it('з ексклюзивним замком ключа з TS: INSERT, UPDATE, DELETE проходять (парність ключа SQL ↔ TS)', async () => {
    await db.admin(async (d) => {
      await advisoryXactLock(d, LOCK_KEYS.languagesSet);
      await d.execute(insert('lw'));
      await d.execute(
        sql`update public.languages set name = 'n2' where code = 'lw'`,
      );
      await d.execute(sql`delete from public.languages where code = 'lw'`);
    });
    expect(
      await db.q(`select 1 from public.languages where code = 'lw'`),
    ).toHaveLength(0);
  });

  it('літерал ключа в тілі тригера дорівнює LOCK_KEYS.languagesSet', async () => {
    const rows = await db.q(
      `select prosrc from pg_proc where proname = 'languages_require_lock'`,
    );
    const m = /hashtextextended\('([^']+)', 0\)/.exec(String(rows[0]?.prosrc));
    expect(m?.[1]).toBe(LOCK_KEYS.languagesSet);
  });
});
