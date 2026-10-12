// Юніт теки міграцій (Е8-О3, Е8-О4): сума не залежить від кінців рядків, а
// файл, що керує транзакцією сам, відкидається ДО будь-якого накату.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { listMigrationFiles, MigrationTransactionControlError } from '..';

const CANON_DIR = join(import.meta.dirname, '../../../migrations');

let dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  dirs = [];
});

/** Тимчасова тека з файлами `{ ім'я: вміст }`. */
const dirWith = (files: Record<string, string>): string => {
  const dir = mkdtempSync(join(tmpdir(), 'simplycms-migrate-files-'));
  dirs.push(dir);
  for (const [name, sql] of Object.entries(files))
    writeFileSync(join(dir, name), sql);
  return dir;
};

const refusal = (sql: string) => {
  try {
    listMigrationFiles(dirWith({ '0005_x.sql': sql }));
  } catch (err) {
    if (err instanceof MigrationTransactionControlError)
      return { file: err.file, reason: err.reason };
    throw err;
  }
  return null;
};

describe('listMigrationFiles', () => {
  it('\\r\\n і \\n — одна сума', () => {
    const sql = 'create table a (id int);\nselect 1;\n';
    const [crlf, lf] = listMigrationFiles(
      dirWith({ '0001_a.sql': sql.replace(/\n/g, '\r\n'), '0002_b.sql': sql }),
    );
    expect(crlf!.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(crlf!.checksum).toBe(lf!.checksum);
  });

  it('лише *.sql без підтек, у порядку імен', () => {
    const dir = dirWith({
      '0002_b.sql': 'select 2;',
      '0001_a.sql': 'select 1;',
      'README.md': '# ні',
    });
    mkdirSync(join(dir, 'demo'));
    writeFileSync(join(dir, 'demo/0000_seed.sql'), 'select 0;');
    expect(listMigrationFiles(dir).map((f) => f.name)).toEqual([
      '0001_a.sql',
      '0002_b.sql',
    ]);
  });

  it('канон ядра проходить перевірку (функції з begin … end у $$)', () => {
    expect(listMigrationFiles(CANON_DIR).length).toBeGreaterThanOrEqual(5);
  });

  it('concurrently → відмова з іменем файлу', () => {
    expect(refusal('create index concurrently i on t (a);')).toEqual({
      file: '0005_x.sql',
      reason: 'concurrently',
    });
  });

  it.each([
    ['begin;\ncreate table t (id int);', 'begin'],
    ['BEGIN TRANSACTION;', 'begin'],
    ['start transaction;', 'begin'],
    ['create table t (id int);\ncommit;', 'commit'],
    ['create table t (id int);\nEND;', 'commit'],
    ['rollback;', 'commit'],
  ])('верхньорівневе керування транзакцією: %j → %s', (sql, reason) => {
    expect(refusal(sql)?.reason).toBe(reason);
  });

  it.each([
    'do $$ begin perform 1; end $$;',
    `create function f() returns trigger language plpgsql as $fn$
     begin
       return new;
     end;
     $fn$;`,
    '-- begin;\n/* commit; /* вкладений */ concurrently */ select 1;',
    'select \'commit; begin; concurrently\', "begin" from t;',
    "select E'it\\'s; commit;';",
    'savepoint s; rollback to savepoint s;',
  ])('не керування транзакцією: %j', (sql) => {
    expect(refusal(sql)).toBeNull();
  });
});
