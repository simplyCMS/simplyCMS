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
  compareMigrationsMulti,
  copyMigrations,
  lintPluginMigrationSql,
  listSqlFiles,
  parseDbDiffArgs,
  pluginMigrationSources,
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

// N канонів (Фаза 3, Р4): ядро + міграції встановлених плагінів.
describe('cli db:diff: мульти-канони', () => {
  it('pluginMigrationSources: читає конфіг, бачить node_modules і @plugins/, пропускає плагіни без міграцій', async () => {
    const store = await scaffoldStore('db-plugin-sources');
    // Шаблон декларує hello-world (@plugins/, без migrations/) і faq
    // (@simplycms/plugin-faq у node_modules) — створюємо теку лише faq.
    const faqDir = join(
      store,
      'node_modules',
      '@simplycms',
      'plugin-faq',
      'migrations',
    );
    mkdirSync(faqDir, { recursive: true });
    writeFileSync(
      join(faqDir, '20260814120000_plg_faq_items.sql'),
      'select 1;\n',
    );

    const sources = pluginMigrationSources(store);
    // lintName — КАНОНІЧНЕ імʼя зі специфікатора (не конфіг-ключ): саме воно
    // задає префікс plg_* для лінта меж, і --name-аліас його не зіб'є.
    expect(sources).toEqual([
      {
        name: 'faq',
        spec: '@simplycms/plugin-faq',
        dir: faqDir,
        lintName: 'faq',
      },
    ]);
  });

  it('compareMigrationsMulti: own рахується по ОБʼЄДНАННЮ канонів', async () => {
    const store = await scaffoldStore('db-multi-own');
    const schemaDir = makeSchemaDir(store);
    const storeDir = storeMigrationsDir(store);
    const pluginDir = mkdtempSync(join(tmpdir(), 'cli-db-plg-'));
    // Міграція плагіна ВЖЕ скопійована в магазин: без другого канону вона
    // брехливо значилась би «власною».
    writeFileSync(
      join(pluginDir, '99999999999999_plg_faq_items.sql'),
      'select 1;\n',
    );
    writeFileSync(
      join(storeDir, '99999999999999_plg_faq_items.sql'),
      'select 1;\n',
    );
    const single = compareMigrationsMulti(storeDir, [
      { name: null, spec: 'simplycms/schema', dir: schemaDir },
    ]);
    expect(single.own).toEqual(['99999999999999_plg_faq_items.sql']);

    const multi = compareMigrationsMulti(storeDir, [
      { name: null, spec: 'simplycms/schema', dir: schemaDir },
      { name: 'faq', spec: '@simplycms/plugin-faq', dir: pluginDir },
    ]);
    expect(multi.own).toEqual([]);
    expect(multi.collisions).toEqual([]);
    expect(multi.perSource[1].missing).toEqual([]);
  });

  it('compareMigrationsMulti: одне імʼя з різним вмістом у двох канонах — collision', async () => {
    const store = await scaffoldStore('db-multi-collision');
    const schemaDir = makeSchemaDir(store);
    const a = mkdtempSync(join(tmpdir(), 'cli-db-a-'));
    const b = mkdtempSync(join(tmpdir(), 'cli-db-b-'));
    writeFileSync(join(a, '99999999999999_same.sql'), 'select 1;\n');
    writeFileSync(join(b, '99999999999999_same.sql'), 'select 2;\n');
    const { collisions } = compareMigrationsMulti(storeMigrationsDir(store), [
      { name: null, spec: 'simplycms/schema', dir: schemaDir },
      { name: 'a', spec: 'a', dir: a },
      { name: 'b', spec: 'b', dir: b },
    ]);
    expect(collisions).toEqual(['99999999999999_same.sql']);
  });
});

// SQL-лінт межі довіри (спека §7/§9): лише таблиці plg_<name>_*.
describe('cli db:diff: lintPluginMigrationSql', () => {
  it('реальна міграція faq — чиста', () => {
    const sql = readFileSync(
      'packages/simplycms-plugin-faq/migrations/20260814120000_plg_faq_items.sql',
      'utf8',
    );
    expect(lintPluginMigrationSql(sql, 'faq')).toEqual([]);
  });

  it('чужа таблиця в CREATE/ALTER/POLICY/REFERENCES — порушення поіменно', () => {
    const sql = [
      'create table public.orders (id uuid);',
      'alter table public.plg_faq_items add column x text;',
      'create policy "p" on public.products for select using (true);',
      'create table plg_faq_extra (ref uuid references public.users (id));',
    ].join('\n');
    const violations = lintPluginMigrationSql(sql, 'faq');
    expect(violations).toHaveLength(3);
    expect(violations.join('\n')).toContain('"orders"');
    expect(violations.join('\n')).toContain('"products"');
    expect(violations.join('\n')).toContain('"users"');
  });

  it('дефіс в імені плагіна мапиться на підкреслення префікса', () => {
    expect(
      lintPluginMigrationSql(
        'create table plg_hello_world_notes (id uuid);',
        'hello-world',
      ),
    ).toEqual([]);
  });
});
