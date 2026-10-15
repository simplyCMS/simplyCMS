// М1 Task 2 (І1–І3 майстра): машина станів мови тримає БД, а не код операцій.
// Кожен кейс — окрема транзакція з відкатом (`queryInTransaction`), тому
// сід основної мови лишається недоторканим для сусідніх кейсів.
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

const ID_A = '00000002-0000-4000-8000-0000000000a1';
const ID_B = '00000002-0000-4000-8000-0000000000a2';
const FORMAT_CHECK = `^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2})?$`;

/** Вставка не-основної мови в `draft`. */
const add = (id: string, code: string) =>
  `insert into public.languages (id, code, name, status, is_default, sort_order)
   values ('${id}', '${code}', 'Тест', 'draft', false, 1)`;

describe('мови: інваріанти в БД (І1–І3)', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_languages_invariants');
  let dbUrl: string;
  const tx = (...statements: string[]) => queryInTransaction(dbUrl, statements);

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

  it('код незмінний', async () => {
    await expect(
      tx(`update public.languages set code = 'en' where is_default`),
    ).rejects.toThrow('languages: код і основна мова незмінні');
  });

  it('основна незмінна', async () => {
    await expect(
      tx(`update public.languages set is_default = false where is_default`),
    ).rejects.toThrow('languages: код і основна мова незмінні');
  });

  it('не-основну не можна зробити основною', async () => {
    await expect(
      tx(
        add(ID_A, 'pl'),
        `update public.languages set is_default = true, status = 'published' where id = '${ID_A}'`,
      ),
    ).rejects.toThrow('languages: код і основна мова незмінні');
  });

  it('основна лише published', async () => {
    await expect(
      tx(`update public.languages set status = 'draft' where is_default`),
    ).rejects.toThrow('languages: код і основна мова незмінні');
  });

  it('основну не видалити', async () => {
    await expect(
      tx(`delete from public.languages where is_default`),
    ).rejects.toThrow('languages: основну мову не видалити');
  });

  it('не-основну без перекладів видалити можна', async () => {
    const rows = await tx(
      add(ID_A, 'pl'),
      `delete from public.languages where id = '${ID_A}' returning id`,
    );
    expect(rows).toHaveLength(1);
  });

  it('не-основну можна перейменувати й перевести між станами', async () => {
    const rows = await tx(
      add(ID_A, 'pl'),
      `update public.languages set name = 'Polski', status = 'published', sort_order = 5
        where id = '${ID_A}' returning status`,
    );
    expect(rows).toEqual([{ status: 'published' }]);
  });

  it('INSERT основної не в published ловить CHECK languages_default_published', async () => {
    // Сід уже тримає основну: без CHECK друга впала б на унікальному індексі
    // (23505), тож саме код 23514 доводить, що CHECK спрацював першим.
    await expect(
      tx(
        `insert into public.languages (id, code, name, status, is_default)
         values ('${ID_A}', 'pl', 'Polski', 'draft', true)`,
      ),
    ).rejects.toMatchObject({
      code: '23514',
      constraint: 'languages_default_published',
    });
  });

  describe('формат BCP 47', () => {
    // `on conflict do nothing`: `uk` уже є сідом основної мови, а CHECK
    // перевіряється ДО розвʼязання конфлікту — відмова формату все одно
    // впала б помилкою 23514, тож мовчазне завершення доводить прийняття коду.
    it.each(['uk', 'pt-BR', 'zh-Hans', 'zh-Hans-CN'])(
      '%s проходить',
      async (code) => {
        await expect(
          tx(`${add(ID_A, code)} on conflict (code) do nothing`),
        ).resolves.toBeDefined();
      },
    );

    it.each(['UA', 'uk_UA', 'pt-br', 'english'])(
      '%s відхиляється',
      async (code) => {
        await expect(tx(add(ID_A, code))).rejects.toMatchObject({
          code: '23514',
          constraint: 'languages_code_format',
        });
      },
    );
  });

  it('унікальність за кодом: en-GB двічі → languages_code_key', async () => {
    await expect(
      tx(add(ID_A, 'en-GB'), add(ID_B, 'en-GB')),
    ).rejects.toMatchObject({
      code: '23505',
      constraint: 'languages_code_key',
    });
  });

  it('регістронезалежний дубль: en-GB і en-gb → languages_code_lower_key', async () => {
    // CHECK формату забороняє `en-gb` раніше за індекс, тож у цій транзакції
    // його послаблено до регістронезалежного (DDL у Postgres транзакційний,
    // відкат повертає суворий CHECK). Так індекс доводиться поведінкою, а не
    // фактом існування.
    await expect(
      tx(
        'alter table public.languages drop constraint languages_code_format',
        `alter table public.languages add constraint languages_code_format
           check (code ~* '${FORMAT_CHECK}')`,
        add(ID_A, 'en-GB'),
        add(ID_B, 'en-gb'),
      ),
    ).rejects.toMatchObject({
      code: '23505',
      constraint: 'languages_code_lower_key',
    });
  });
});
