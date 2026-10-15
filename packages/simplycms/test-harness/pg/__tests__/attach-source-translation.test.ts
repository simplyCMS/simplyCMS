// М1 Task 4: процедура `attach_source_translation_triggers` відхиляє хибні
// аргументи ЗРОЗУМІЛОЮ помилкою (а не сирим "column does not exist" з глибини
// DDL), підключає тригери ідемпотентно і з тим самим переліком колонок, який
// чекає функція; сама функція падає голосно на хибному підключенні.
// Кожен кейс — власна транзакція: або з відкатом, або з COMMIT, що має впасти.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveHarness } from '../up.mjs';
import {
  applyCanon,
  createTempDatabase,
  dropTempDatabase,
  queryInTransaction,
  randomDbName,
  withDbName,
} from '../apply.mjs';
import { withActor } from '../actors.mjs';

const RAW = [
  'create table public.t_b (id uuid primary key, kind text)',
  `create table public.t_t (
     b_id uuid references public.t_b(id) on delete cascade,
     locale text, name text, note text, primary key (b_id, locale))`,
];
const attach = (args: string) =>
  `call public.attach_source_translation_triggers('public.t_b', 'public.t_t', ${args})`;
const OK = `'b_id', array['name']`;
const ID = '00000004-0000-4000-8000-000000000001';

describe('підключення тригера обовʼязкового рядка основної мови', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_attach_source_translation');
  let dbUrl: string;
  const tx = (...sql: string[]) => queryInTransaction(dbUrl, [...RAW, ...sql]);
  /** Власник без `SET ROLE`: COMMIT, що має впасти, відкотить і DDL. */
  const commit = (...sql: string[]) => withActor(dbUrl, {}, [...RAW, ...sql]);

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applyCanon(dbUrl);
  }, 120_000);

  afterAll(async () => {
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  it.each([
    ['невідома обовʼязкова колонка', `'b_id', array['name', 'nope']`, 'nope'],
    ['невідомий FK', `'nope', array['name']`, 'nope'],
    ['порожній перелік обовʼязкових', `'b_id', array[]::text[]`, 'обовʼязков'],
    ['кома в назві колонки', `'b_id', array['a,b']`, 'a,b'],
    ['невідома колонка умови', `'b_id', array['name'], 'nope=text'`, 'nope'],
    ['умова без значення', `'b_id', array['name'], 'kind'`, 'col=value'],
  ])('%s — зрозуміла помилка', async (_label, args, fragment) => {
    await expect(tx(attach(args))).rejects.toThrow(
      new RegExp(`attach_source_translation_triggers: .*${fragment}`),
    );
  });

  it('таблиця поза схемою public — відмова', async () => {
    await expect(
      queryInTransaction(dbUrl, [
        'create schema other',
        'create table other.t_b (id uuid primary key)',
        `create table other.t_t (b_id uuid, locale text, name text)`,
        `call public.attach_source_translation_triggers('other.t_b', 'other.t_t', 'b_id', array['name'])`,
      ]),
    ).rejects.toThrow(/схеми public/);
  });

  it('повторний виклик ідемпотентний, тригерів рівно два з потрібним UPDATE OF', async () => {
    const rows = await tx(
      attach(OK),
      attach(OK),
      `select tgrelid::regclass::text as rel, pg_get_triggerdef(oid) as def
         from pg_trigger
        where tgname like '%require_source_translation' order by 1`,
    );
    expect(rows.map((r) => r.rel)).toEqual(['t_b', 't_t']);
    expect(rows[0].def).toContain('AFTER INSERT ON public.t_b');
    expect(rows[1].def).toContain(
      'AFTER DELETE OR UPDATE OF name, locale, b_id ON public.t_t',
    );
    for (const r of rows)
      expect(r.def).toMatch(
        /CONSTRAINT TRIGGER .* DEFERRABLE INITIALLY DEFERRED/,
      );
  });

  it('без основної мови базовий рядок — відмова з чітким повідомленням', async () => {
    // Тригер `languages_guard` вимкнено лише в цій транзакції: порожню БД до
    // bootstrap так не відтворити, а відмова мусить бути не «немає перекладу».
    await expect(
      commit(
        attach(OK),
        'alter table public.languages disable trigger languages_guard',
        'update public.languages set is_default = false where is_default',
        `insert into public.t_b (id) values ('${ID}')`,
      ),
    ).rejects.toMatchObject({
      code: '23514',
      message: 't_b: немає основної мови, переклад неможливий',
    });
  });

  it('ручне підключення з невідомою роллю падає голосно', async () => {
    await expect(
      commit(
        `create constraint trigger t_b_bogus after insert on public.t_b
           deferrable initially deferred for each row
           execute function public.require_source_translation('bogus', 't_b', 't_t', 'b_id', 'name')`,
        `insert into public.t_b (id) values ('${ID}')`,
      ),
    ).rejects.toThrow('require_source_translation: невідомі аргументи тригера');
  });
});
