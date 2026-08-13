import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertSchemaMigrations,
  compareMigrations,
  copyMigrations,
  listSqlFiles,
  parseDbDiffArgs,
  schemaMigrationsPath,
  storeMigrationsDir,
} from '../packages/cli/src/db-diff.mjs';
import { scaffold } from '../packages/create-simplycms-store/src/scaffold.mjs';

// simplycms db:diff (§4.4): порівняння міграцій магазину з міграціями ядра —
// на реальному скаффолді шаблону, зі штучною текою schema/migrations у
// tmp-node_modules. Без мережі й без БД.
async function scaffoldStore(name: string) {
  const target = join(mkdtempSync(join(tmpdir(), 'cli-db-')), name);
  await scaffold({
    templateDir: 'packages/create-simplycms-store/template',
    targetDir: target,
    storeName: name,
    version: '9.9.9-sentinel',
  });
  return target;
}

/** Штучне «встановлене ядро»: копія всіх міграцій магазину в node_modules. */
function makeSchemaDir(store: string) {
  const schemaDir = schemaMigrationsPath(store);
  mkdirSync(schemaDir, { recursive: true });
  const storeDir = storeMigrationsDir(store);
  for (const name of readdirSync(storeDir))
    cpSync(join(storeDir, name), join(schemaDir, name));
  return schemaDir;
}

describe('cli db:diff', () => {
  it('parseDbDiffArgs: --write приймається, невідомий аргумент — помилка', () => {
    expect(parseDbDiffArgs([])).toEqual({ write: false });
    expect(parseDbDiffArgs(['--write'])).toEqual({ write: true });
    expect(() => parseDbDiffArgs(['--wat'])).toThrow(/--wat/);
  });

  it('assertSchemaMigrations: стара версія ядра без migrations/ — гучна помилка', async () => {
    const store = await scaffoldStore('db-old-core');
    expect(() => assertSchemaMigrations(store)).toThrow(/стара версія ядра/);
    const schemaDir = makeSchemaDir(store);
    expect(assertSchemaMigrations(store)).toBe(schemaDir);
  });

  it('compareMigrations: синхронний стан — усі списки порожні', async () => {
    const store = await scaffoldStore('db-sync');
    const schemaDir = makeSchemaDir(store);
    expect(compareMigrations(storeMigrationsDir(store), schemaDir)).toEqual({
      missing: [],
      own: [],
      changed: [],
    });
  });

  it('compareMigrations: нові в ядрі — missing, власні магазину — own', async () => {
    const store = await scaffoldStore('db-lists');
    const schemaDir = makeSchemaDir(store);
    writeFileSync(
      join(schemaDir, '99999999999999_core_new.sql'),
      'select 1;\n',
    );
    writeFileSync(
      join(storeMigrationsDir(store), '99999999999998_custom.sql'),
      'select 2;\n',
    );
    const diff = compareMigrations(storeMigrationsDir(store), schemaDir);
    expect(diff.missing).toEqual(['99999999999999_core_new.sql']);
    expect(diff.own).toEqual(['99999999999998_custom.sql']);
    expect(diff.changed).toEqual([]);
  });

  it('compareMigrations: спільне імʼя з різним вмістом — changed (конфлікт)', async () => {
    const store = await scaffoldStore('db-conflict');
    const schemaDir = makeSchemaDir(store);
    const [shared] = listSqlFiles(schemaDir);
    writeFileSync(join(schemaDir, shared), '-- інший вміст\n');
    const diff = compareMigrations(storeMigrationsDir(store), schemaDir);
    expect(diff.changed).toEqual([shared]);
    // Конфлікт — не «нова міграція»: імʼя спільне, тож у missing його немає.
    expect(diff.missing).toEqual([]);
  });

  it('copyMigrations (--write): докопіює нові байт-у-байт, повторний дифф чистий', async () => {
    const store = await scaffoldStore('db-write');
    const schemaDir = makeSchemaDir(store);
    writeFileSync(
      join(schemaDir, '99999999999999_core_new.sql'),
      'select 1;\n',
    );
    const storeDir = storeMigrationsDir(store);
    const { missing } = compareMigrations(storeDir, schemaDir);
    copyMigrations(storeDir, schemaDir, missing);
    expect(
      readFileSync(join(storeDir, '99999999999999_core_new.sql'), 'utf8'),
    ).toBe('select 1;\n');
    expect(compareMigrations(storeDir, schemaDir)).toEqual({
      missing: [],
      own: [],
      changed: [],
    });
  });

  it('listSqlFiles: лише *.sql, відсортовано; відсутня тека → []', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cli-db-sql-'));
    writeFileSync(join(dir, '2_b.sql'), 'b');
    writeFileSync(join(dir, '1_a.sql'), 'a');
    writeFileSync(join(dir, 'README.md'), 'не sql');
    expect(listSqlFiles(dir)).toEqual(['1_a.sql', '2_b.sql']);
    expect(listSqlFiles(join(dir, 'nema'))).toEqual([]);
  });
});
