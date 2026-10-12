// Контракт `applyOne` (К3-Е8, прийом А1, мутація м10): файл міграції і його
// рядок у журналі — ОДНА транзакція. Кейс «SQL-помилка у файлі» цього не
// доводить: файл іде в Postgres одним рядком simple-протоколу, і сервер сам
// загортає кілька команд у неявну транзакцію — без нашого `begin` той кейс
// лишається зеленим. Тут падає саме запис у журнал ПІСЛЯ успішного DDL: без
// спільної транзакції файл лишився б накоченим без рядка, і наступний старт
// котив би неідемпотентний DDL удруге.
import pg from 'pg';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { applyMigrations } from 'simplycms/migrate';
import { resolveHarness } from '../up.mjs';
import { canonCopy, exists, freshDb, journalOf } from './fixtures/migrate';

const JOURNAL_INSERT = /^insert into public\.simplycms_migrations/;

describe('applyMigrations: файл і рядок журналу — одна транзакція', () => {
  let harness: { url: string; teardown: () => Promise<void> };

  beforeAll(async () => {
    harness = await resolveHarness();
  }, 60_000);

  afterAll(async () => {
    await harness?.teardown();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('збій запису в журнал після DDL → DDL відкочено, повтор накочує чисто', async () => {
    const db = await freshDb(harness.url);
    const copy = canonCopy();
    try {
      await applyMigrations({ connectionString: db.url, dir: copy.dir });
      copy.write('0006_x.sql', 'create table public.x_tx (id int);');

      const original = pg.Client.prototype.query;
      vi.spyOn(pg.Client.prototype, 'query').mockImplementation(function (
        this: pg.Client,
        ...args: Parameters<typeof original>
      ) {
        const [text, values] = args as unknown as [unknown, unknown];
        if (
          typeof text === 'string' &&
          JOURNAL_INSERT.test(text) &&
          Array.isArray(values) &&
          values[0] === '0006_x.sql'
        ) {
          return Promise.reject(new Error('шпигун: запис у журнал впав'));
        }
        return Reflect.apply(original, this, args);
      } as typeof original);

      await expect(
        applyMigrations({ connectionString: db.url, dir: copy.dir }),
      ).rejects.toThrow();
      expect(await exists(db.url, 'public.x_tx')).toBe(false);
      const names = (await journalOf(db.url)).map((row) => row.name);
      expect(names).not.toContain('0006_x.sql');

      vi.restoreAllMocks();
      const again = await applyMigrations({
        connectionString: db.url,
        dir: copy.dir,
      });
      expect(again.applied).toEqual(['0006_x.sql']);
      expect(await exists(db.url, 'public.x_tx')).toBe(true);
    } finally {
      copy.cleanup();
      await db.drop();
    }
  }, 120_000);
});
