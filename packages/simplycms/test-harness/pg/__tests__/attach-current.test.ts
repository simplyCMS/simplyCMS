// М1 Task 5 (К4): процедури `attach_current_address_triggers` / `…_token_…` на
// пробних таблицях, створених у тесті. Доводить поведінку тригера БАЗИ (усі мови
// draft/published зі знімка, disabled не вимагається, вставка мови тригер не
// запускає), яку на реальних `products`/`product_modifications` вимкнено до Task 17.
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { useAddressingDb } from './fixtures/addressing-db';
import { LANGUAGES_LOCK_SQL } from '../apply.mjs';

const CHECK = { code: '23514' };
const INVALID = { code: '22023' };

const VARIANTS = [
  {
    name: 'адреси',
    proc: 'attach_current_address_triggers',
    col: 'path',
    suf: 'cur_addr',
  },
  {
    name: 'токени',
    proc: 'attach_current_token_triggers',
    col: 'slug',
    suf: 'cur_tok',
  },
] as const;

describe.each(VARIANTS)('тригер наявності поточного: $name', (v) => {
  const db = useAddressingDb(`simplycms_attach_${v.suf}`);
  const { q, tx } = db;
  const base = `probe_${v.suf}`;
  const reg = `probe_${v.suf}_reg`;
  const attach = (b: string, r: string, fk: string) =>
    q(
      `call public.${v.proc}('public.${b}'::regclass, 'public.${r}'::regclass, '${fk}')`,
    );
  const addr = (id: string, locale: string, current = true) =>
    `insert into public.${reg} (id, locale, ${v.col}, probe_id, is_current)
     values (gen_random_uuid(), '${locale}', 'v-${id.slice(0, 8)}', '${id}', ${current})`;
  const insBase = (id: string) =>
    `insert into public.${base} (id) values ('${id}')`;

  beforeAll(async () => {
    await db.language('en');
    await db.language('de', 'draft');
    await db.language('fr', 'disabled');
    await q(`create table public.${base} (id uuid primary key)`);
    await q(
      `create table public.${reg} (
         id uuid primary key,
         locale text not null references public.languages(code) on delete cascade,
         ${v.col} text not null,
         probe_id uuid not null references public.${base}(id) on delete cascade,
         is_current boolean not null)`,
    );
    await q(
      `grant select, insert, update, delete on public.${base}, public.${reg} to app_admin`,
    );
    await attach(base, reg, 'probe_id');
  });

  it('база без адреси — відмова на коміті', async () => {
    await expect(tx(insBase(randomUUID()))).rejects.toMatchObject(CHECK);
  });

  it('база з поточною адресою в усіх мовах draft/published — коміт (disabled не вимагається)', async () => {
    const id = randomUUID();
    await tx(insBase(id), addr(id, 'uk'), addr(id, 'en'), addr(id, 'de'));
    expect(
      await q(`select 1 from public.${base} where id = $1`, [id]),
    ).toHaveLength(1);
  });

  it('draft-мова теж вимагається: бракує de — відмова', async () => {
    const id = randomUUID();
    await expect(
      tx(insBase(id), addr(id, 'uk'), addr(id, 'en')),
    ).rejects.toMatchObject(CHECK);
  });

  it('лише історична адреса не рахується', async () => {
    const id = randomUUID();
    await expect(
      tx(insBase(id), addr(id, 'uk', false), addr(id, 'en'), addr(id, 'de')),
    ).rejects.toMatchObject(CHECK);
  });

  it('база, вставлена й видалена в одній транзакції, адреси не вимагає', async () => {
    const id = randomUUID();
    await tx(insBase(id), `delete from public.${base} where id = '${id}'`);
  });

  it('вставка рядка мови тригер не запускає (товари без адреси в новій мові комітяться)', async () => {
    await tx(
      LANGUAGES_LOCK_SQL,
      `insert into public.languages (id, code, name, status, is_default, sort_order)
       values (gen_random_uuid(), 'sk', 'sk', 'draft', false, 9)`,
    );
    expect(
      await q(`select 1 from public.languages where code = 'sk'`),
    ).toHaveLength(1);
  });

  it('повторний виклик процедури ідемпотентний: рівно два тригери', async () => {
    await attach(base, reg, 'probe_id');
    const got = await q(
      `select tgname, tgenabled from pg_trigger
        where tgrelid in ('public.${base}'::regclass, 'public.${reg}'::regclass)
          and not tgisinternal order by tgname`,
    );
    expect(got).toEqual([
      { tgname: `${base}_${v.suf}_b`, tgenabled: 'O' },
      { tgname: `${reg}_${v.suf}_r`, tgenabled: 'O' },
    ]);
  });

  it('хибні аргументи → invalid_parameter_value з назвою колонки', async () => {
    await expect(attach(base, reg, 'no_such_col')).rejects.toMatchObject({
      ...INVALID,
      message: expect.stringContaining('no_such_col'),
    });
    await expect(attach(base, reg, 'locale')).rejects.toMatchObject(INVALID); // не uuid
    await expect(attach(base, reg, 'id')).rejects.toMatchObject(INVALID); // не FK на base
    await expect(
      q(
        `call public.${v.proc}('pg_catalog.pg_class'::regclass, 'public.${reg}'::regclass, 'probe_id')`,
      ),
    ).rejects.toMatchObject(INVALID);
  });

  it('довгі імена таблиць: імена тригерів обрізаються до 63 байт', async () => {
    const long = `probe_${v.suf}_${'x'.repeat(38)}`;
    await q(`create table public.${long} (id uuid primary key)`);
    await q(
      `create table public.${long}_rg (id uuid primary key, locale text, ${v.col} text,
         probe_id uuid references public.${long}(id), is_current boolean)`,
    );
    await attach(long, `${long}_rg`, 'probe_id');
    const names = await q(
      `select tgname from pg_trigger where tgrelid = 'public.${long}'::regclass and not tgisinternal`,
    );
    expect(String(names[0].tgname).length).toBeLessThanOrEqual(63);
  });
});
