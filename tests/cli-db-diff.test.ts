import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertSchemaMigrations,
  compareMigrations,
  compareMigrationsMulti,
  copyMigrations,
  findRemovedCoreMigrations,
  lintPluginMigrationSql,
  listSqlFiles,
  parseDbDiffArgs,
  pluginMigrationSources,
  readRemovedManifest,
  run,
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
  // 🔴 `{ recursive: true }` обовʼязковий: канон везе піддиректорію
  // `demo/` (demo-сід, поза каноном db:diff) — без опції cpSync падає на
  // директорії з "cannot copy a directory".
  for (const name of readdirSync(storeDir))
    cpSync(join(storeDir, name), join(schemaDir, name), { recursive: true });
  return schemaDir;
}

describe('cli db:diff', () => {
  it('parseDbDiffArgs: --write приймається, невідомий аргумент — помилка', () => {
    expect(parseDbDiffArgs([])).toEqual({ write: false, rebaseline: false });
    expect(parseDbDiffArgs(['--write'])).toEqual({
      write: true,
      rebaseline: false,
    });
    expect(parseDbDiffArgs(['--write', '--rebaseline'])).toEqual({
      write: true,
      rebaseline: true,
    });
    expect(() => parseDbDiffArgs(['--wat'])).toThrow(/--wat/);
  });

  it('schemaMigrationsPath: міграції лежать на рівні пакета simplycms', async () => {
    const store = await scaffoldStore('db-core-path');
    // 🔴 Саме `node_modules/simplycms/migrations`, а не підтека схеми:
    // tarball ядра везе міграції на рівні пакета (files: [... "migrations"]).
    expect(schemaMigrationsPath(store)).toBe(
      join(store, 'node_modules', 'simplycms', 'migrations'),
    );
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
    // Шаблон декларує лише hello-world (@plugins/, без migrations/) — FAQ
    // знято з шаблону (ПК7), тож довстановлюємо його тут, як це робить
    // магазин: рядок у конфізі + пакет у node_modules.
    const configPath = join(store, 'simplycms.config.ts');
    writeFileSync(
      configPath,
      readFileSync(configPath, 'utf8').replace(
        'plugins: [',
        "plugins: [\n    { name: 'faq', module: () => import('@simplycms/plugin-faq') },",
      ),
    );
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

describe('cli db:diff: відсутня тека міграцій магазину', () => {
  afterEach(() => {
    process.exitCode = undefined;
  });

  /** Запускає `run` у корені магазину з тихим виводом; повертає exitCode. */
  async function runIn(store: string, argv: string[]) {
    const cwd = process.cwd();
    const silent = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    try {
      process.chdir(store);
      await run(argv);
      return process.exitCode;
    } finally {
      process.chdir(cwd);
      silent.mockRestore();
    }
  }

  it('без db/migrations: --write відмовляє (exit 1) і не створює теку', async () => {
    const store = await scaffoldStore('no-migrations');
    makeSchemaDir(store);
    rmSync(storeMigrationsDir(store), { recursive: true });

    expect(await runIn(store, ['--write'])).toBe(1);
    expect(existsSync(storeMigrationsDir(store))).toBe(false);
  });

  it('db/migrations — файл: відмова (exit 1), файл не чіпано, без ENOTDIR', async () => {
    const store = await scaffoldStore('file-migrations');
    makeSchemaDir(store);
    rmSync(storeMigrationsDir(store), { recursive: true });
    writeFileSync(storeMigrationsDir(store), 'не тека\n');

    expect(await runIn(store, ['--write'])).toBe(1);
    expect(readFileSync(storeMigrationsDir(store), 'utf8')).toBe('не тека\n');
  });

  it('зі старою supabase/migrations: відмова теж, теку db/migrations не створено', async () => {
    const store = await scaffoldStore('legacy-migrations');
    makeSchemaDir(store);
    rmSync(storeMigrationsDir(store), { recursive: true });
    mkdirSync(join(store, 'supabase', 'migrations'), { recursive: true });

    expect(await runIn(store, ['--write'])).toBe(1);
    expect(existsSync(storeMigrationsDir(store))).toBe(false);
  });
});

const STALE = '0005_mail_outbox.sql';
const STALE_SQL = 'create table mail_outbox ();\n';
const sha = (text: string) =>
  createHash('sha256').update(text, 'utf8').digest('hex');
const entry = (name: string, sql: string) => ({
  name,
  sha256: sha(sql),
  removedIn: '0.16.0 (baseline-виняток М1)',
  reason: 'mail_outbox злито в 0001_init.sql',
});

/** `run` у корені магазину; вивід збирається й нормалізується (рамки clack). */
async function runCaptured(store: string, argv: string[]) {
  const cwd = process.cwd();
  let output = '';
  const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    output += String(chunk);
    return true;
  });
  try {
    process.chdir(store);
    await run(argv);
  } finally {
    process.chdir(cwd);
    spy.mockRestore();
  }
  return {
    exitCode: process.exitCode,
    output: output.replace(/[│\s]+/g, ' '),
  };
}

/** Файли теки (без підтек) → вміст: порівняння «до/після» для «нічого не записано». */
const snapshot = (dir: string): Record<string, string> =>
  Object.fromEntries(
    readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => [
        entry.name,
        readFileSync(join(dir, entry.name), 'utf8'),
      ]),
  );

// Файли, ПРИБРАНІ з канону ядра (baseline-винятки до 1.0.0-rc.1): `db:diff --write`
// лише докопіює нове й сам не видалив би застарілий файл, а той ламає накат
// (CREATE TABLE вдруге). Прибирання йде за ЗАКРИТИМ маніфестом `removed.json` —
// точне імʼя + sha256, а не за конвенцією імені: власну `0006_x.sql` магазину
// конвенція не відрізнила б від файлу ядра.
describe('cli db:diff: файли, прибрані з канону ядра', () => {
  afterEach(() => {
    process.exitCode = undefined;
  });

  /** Магазин зі «встановленим ядром», маніфест якого називає STALE. */
  async function storeWithManifest(name: string) {
    const store = await scaffoldStore(name);
    const schemaDir = makeSchemaDir(store);
    const manifest = [entry(STALE, STALE_SQL)];
    writeFileSync(join(schemaDir, 'removed.json'), JSON.stringify(manifest));
    return { store, schemaDir, manifest, storeDir: storeMigrationsDir(store) };
  }

  it('файл з маніфесту з правильним хешем — без --write лише звіт, файл лишився', async () => {
    const { store, storeDir, manifest } = await storeWithManifest('rm-report');
    writeFileSync(join(storeDir, STALE), STALE_SQL);

    expect(findRemovedCoreMigrations(storeDir, manifest)).toEqual([
      { name: STALE, status: 'match' },
    ]);
    const { exitCode, output } = await runCaptured(store, []);
    expect(exitCode).toBeUndefined();
    expect(output).toContain(STALE);
    expect(output).toContain('прибрано з канону ядра');
    // Файл з маніфесту — не «власна» міграція магазину.
    expect(output).not.toContain('Власні міграції');
    expect(existsSync(join(storeDir, STALE))).toBe(true);
  });

  it('змінений файл без --write: звіт із ручною дією, без підказки --write, exit 0', async () => {
    const { store, storeDir } = await storeWithManifest('rm-modified-view');
    writeFileSync(join(storeDir, STALE), `${STALE_SQL}-- правка\n`);

    const { exitCode, output } = await runCaptured(store, []);
    expect(exitCode).toBeUndefined();
    expect(output).toContain('видали файл вручну');
    // `--write` змінений файл не прибере — підказувати його було б брехнею.
    expect(output).not.toContain('db:diff --write');
    expect(existsSync(join(storeDir, STALE))).toBe(true);
  });

  it('--write: збіг імені й хешу → видалено', async () => {
    const { store, storeDir } = await storeWithManifest('rm-write');
    writeFileSync(join(storeDir, STALE), STALE_SQL);

    const { exitCode } = await runCaptured(store, ['--write']);
    expect(exitCode).toBeUndefined();
    expect(existsSync(join(storeDir, STALE))).toBe(false);
    // Решту магазину не зачеплено: це видалення одного названого файлу.
    expect(existsSync(join(storeDir, '0001_init.sql'))).toBe(true);
  });

  it("--write: ім'я збіглось, хеш ні → не видалено, відмова з інструкцією", async () => {
    const { store, storeDir, manifest } =
      await storeWithManifest('rm-modified');
    const edited = `${STALE_SQL}-- власна правка магазину\n`;
    writeFileSync(join(storeDir, STALE), edited);

    expect(findRemovedCoreMigrations(storeDir, manifest)).toEqual([
      { name: STALE, status: 'modified' },
    ]);
    const { exitCode, output } = await runCaptured(store, ['--write']);
    expect(exitCode).toBe(1);
    expect(readFileSync(join(storeDir, STALE), 'utf8')).toBe(edited);
    expect(output).toContain(`${STALE} прибрано з канону ядра у 0.16.0`);
    expect(output).toContain('він змінений (хеш інший)');
    expect(output).toContain(
      'перенеси свої зміни в нову міграцію й видали файл вручну',
    );
    // Заміни не було — нова база не потрібна, але накат після ручного видалення лишається.
    expect(output).toContain(`видали вручну ${STALE}`);
    expect(output).toContain('db:apply');
    expect(output).not.toContain('перестворити базу даних');
  });

  it("файл поза маніфестом з ім'ям 0006_x.sql → не чіпається ні звітом, ні --write", async () => {
    const { store, storeDir, manifest } = await storeWithManifest('rm-own');
    // Вміст = вмісту запису маніфесту: відрізнити від файлу ядра його може
    // лише імʼя, а імʼя 0006_x.sql у маніфесті не названо.
    writeFileSync(join(storeDir, '0006_x.sql'), STALE_SQL);

    expect(findRemovedCoreMigrations(storeDir, manifest)).toEqual([]);
    const { exitCode, output } = await runCaptured(store, ['--write']);
    expect(exitCode).toBeUndefined();
    expect(readFileSync(join(storeDir, '0006_x.sql'), 'utf8')).toBe(STALE_SQL);
    expect(output).not.toContain('прибрано з канону ядра');
  });

  it('плагінний файл → не розглядається', async () => {
    const { store, storeDir, manifest } = await storeWithManifest('rm-plugin');
    const plugin = '20260814120000_plg_faq_items.sql';
    writeFileSync(join(storeDir, plugin), STALE_SQL);

    expect(findRemovedCoreMigrations(storeDir, manifest)).toEqual([]);
    await runCaptured(store, ['--write']);
    expect(readFileSync(join(storeDir, plugin), 'utf8')).toBe(STALE_SQL);
  });

  it('файл з кінцями рядків CRLF (git на Windows) → збіг, а не «змінений»', async () => {
    const { storeDir, manifest } = await storeWithManifest('rm-crlf');
    writeFileSync(join(storeDir, STALE), STALE_SQL.replace(/\n/g, '\r\n'));
    expect(findRemovedCoreMigrations(storeDir, manifest)).toEqual([
      { name: STALE, status: 'match' },
    ]);
  });

  it.each([
    ['вихід за теку', '../0005_x.sql'],
    ['плагінна міграція', '20260814120000_plg_faq_items.sql'],
    ['не .sql', '0005_mail_outbox.json'],
  ])(
    'маніфест з небезпечним імʼям (%s) → відхиляється до будь-якого запису',
    async (_label, name) => {
      const { store, schemaDir, storeDir } =
        await storeWithManifest('rm-bad-name');
      writeFileSync(
        join(schemaDir, 'removed.json'),
        JSON.stringify([entry(name, STALE_SQL)]),
      );
      expect(() => readRemovedManifest(schemaDir)).toThrow(/removed\.json/);

      // Зіпсований маніфест не повинен зупинити `run` ПІСЛЯ часткового запису:
      // нова міграція ядра, яку `--write` скопіював би, лежить у каноні.
      writeFileSync(
        join(schemaDir, '99999999999999_core_new.sql'),
        'select 1;\n',
      );
      const before = snapshot(storeDir);
      await expect(runCaptured(store, ['--write'])).rejects.toThrow(
        /removed\.json/,
      );
      expect(snapshot(storeDir)).toEqual(before);
    },
  );

  it('ядро без removed.json (стара версія) → порожній маніфест, не помилка', async () => {
    const { schemaDir, storeDir } = await storeWithManifest('rm-absent');
    rmSync(join(schemaDir, 'removed.json'));
    expect(readRemovedManifest(schemaDir)).toEqual([]);
    expect(findRemovedCoreMigrations(storeDir, [])).toEqual([]);
  });
});

// Ребазлайн магазину (рішення архітектора 2026-10-15): baseline-виняток змінює
// `0001…0004` ядра, і без цього режиму `db:diff --write` зупинявся на «Спільні
// міграції розійшлися вмістом» — до прибирання застарілих файлів не доходив.
// Один прохід по порядку: прибрати файли з маніфесту → замінити змінені файли
// ядра вмістом канону → докопіювати відсутні. Власні й плагінні — не чіпає.
describe('cli db:diff: --rebaseline', () => {
  afterEach(() => {
    process.exitCode = undefined;
  });

  const BASELINE = ['0001_init.sql', '0003_seed.sql'];

  /**
   * Магазин у стані 0.15.0: baseline-файли `0001`/`0003` старі (відрізняються від
   * канону), застарілий `0005` на місці; «встановлене ядро» — канон + маніфест.
   * `version: null` — без `package.json` ядра.
   */
  async function oldStore(name: string, version: string | null = '0.15.0') {
    const store = await scaffoldStore(name);
    const schemaDir = makeSchemaDir(store);
    writeFileSync(
      join(schemaDir, 'removed.json'),
      JSON.stringify([entry(STALE, STALE_SQL)]),
    );
    if (version !== null)
      writeFileSync(
        join(dirname(schemaDir), 'package.json'),
        JSON.stringify({ name: 'simplycms', version }),
      );
    const storeDir = storeMigrationsDir(store);
    for (const file of BASELINE)
      writeFileSync(
        join(storeDir, file),
        `${readFileSync(join(schemaDir, file), 'utf8')}-- baseline 0.15.0\n`,
      );
    writeFileSync(join(storeDir, STALE), STALE_SQL);
    return { store, schemaDir, storeDir };
  }

  /** Установлює плагін faq (запис у конфігу + канон у node_modules) і змінює його файл у магазині. */
  function withChangedPluginFile(store: string, storeDir: string) {
    const configPath = join(store, 'simplycms.config.ts');
    writeFileSync(
      configPath,
      readFileSync(configPath, 'utf8').replace(
        'plugins: [',
        "plugins: [\n    { name: 'faq', module: () => import('@simplycms/plugin-faq') },",
      ),
    );
    const faqDir = join(store, 'node_modules/@simplycms/plugin-faq/migrations');
    mkdirSync(faqDir, { recursive: true });
    const file = '20260814120000_plg_faq_items.sql';
    writeFileSync(join(faqDir, file), 'create table plg_faq_items ();\n');
    // У магазині той самий файл змінено: плагінні міграції immutable.
    writeFileSync(
      join(storeDir, file),
      'create table plg_faq_items (id int);\n',
    );
    return file;
  }

  const sqlOf = (dir: string) =>
    Object.fromEntries(
      Object.entries(snapshot(dir)).filter(([name]) => name.endsWith('.sql')),
    );

  it('--rebaseline: змінений файл ядра замінено вмістом канону, перелік і рядок про перестворення БД надруковано', async () => {
    const { store, storeDir, schemaDir } = await oldStore('rb-replace');

    const { exitCode, output } = await runCaptured(store, [
      '--write',
      '--rebaseline',
    ]);
    expect(exitCode).toBeUndefined();
    for (const file of BASELINE) {
      expect(readFileSync(join(storeDir, file), 'utf8')).toBe(
        readFileSync(join(schemaDir, file), 'utf8'),
      );
      expect(output).toContain(file);
    }
    expect(output).toContain('базу даних треба перестворити');
    expect(output).toContain('`simplycms_migrations`');
    // Заміна безумовна — власник мусить бачити, що локальні правки зникнуть.
    expect(output).toContain('локальні правки в цих файлах буде втрачено');
    // Незмінений файл ядра в переліку заміни не названо.
    expect(output).not.toContain('0002_grants.sql');
  });

  it('власний 2026…_x.sql і власний 0006_x.sql поза каноном, плагінний <14 цифр>_plg_* — не чіпаються', async () => {
    const { store, storeDir } = await oldStore('rb-own');
    const own = {
      '20260101120000_x.sql': 'select 1;\n',
      '0006_x.sql': 'select 2;\n',
      '20260814120000_plg_faq_items.sql': 'select 3;\n',
    };
    for (const [name, sql] of Object.entries(own))
      writeFileSync(join(storeDir, name), sql);

    await runCaptured(store, ['--write', '--rebaseline']);
    expect(snapshot(storeDir)).toMatchObject(own);
    // Ребазлайн справді відпрацював: без цього «не чіпаються» було б вакуумним.
    expect(snapshot(storeDir)['0001_init.sql']).not.toContain(
      'baseline 0.15.0',
    );
  });

  it('видалення файла з маніфесту в тому самому проході: шлях власника 0.15.0 → усе в каноні', async () => {
    const { store, storeDir, schemaDir } = await oldStore('rb-one-pass');

    const { exitCode } = await runCaptured(store, ['--write', '--rebaseline']);
    expect(exitCode).toBeUndefined();
    expect(existsSync(join(storeDir, STALE))).toBe(false);
    // Теки *.sql магазину й ядра тотожні за іменами й вмістом.
    expect(sqlOf(storeDir)).toEqual(sqlOf(schemaDir));
  });

  it('відсутній у магазині файл канону докопіюється в тому самому проході', async () => {
    const { store, storeDir, schemaDir } = await oldStore('rb-copy-missing');
    // Новий файл ядра, якого в магазині ще немає (крок 3 проходу).
    const added = '0005_next_core.sql';
    writeFileSync(join(schemaDir, added), 'select 1;\n');

    const report = await runCaptured(store, ['--rebaseline']);
    expect(report.output).toContain(added);
    expect(existsSync(join(storeDir, added))).toBe(false);

    const { exitCode } = await runCaptured(store, ['--write', '--rebaseline']);
    expect(exitCode).toBeUndefined();
    expect(readFileSync(join(storeDir, added), 'utf8')).toBe('select 1;\n');
    expect(sqlOf(storeDir)).toEqual(sqlOf(schemaDir));
  });

  it('змінений файл з маніфесту — відмова, решта плану виконується', async () => {
    const { store, storeDir, schemaDir } = await oldStore('rb-modified');
    const edited = `${STALE_SQL}-- власна правка\n`;
    writeFileSync(join(storeDir, STALE), edited);

    const { exitCode, output } = await runCaptured(store, [
      '--write',
      '--rebaseline',
    ]);
    expect(exitCode).toBe(1);
    expect(readFileSync(join(storeDir, STALE), 'utf8')).toBe(edited);
    expect(output).toContain('видали файл вручну');
    for (const file of BASELINE)
      expect(readFileSync(join(storeDir, file), 'utf8')).toBe(
        readFileSync(join(schemaDir, file), 'utf8'),
      );
    // Відмова + заміна: далі ручне видалення, нова база й накат.
    expect(output).toContain(`видали вручну ${STALE}`);
    expect(output).toContain('перестворити базу даних');
    expect(output).toContain('db:apply');
  });

  it.each(['1.0.0-rc.1', '1.0.0-rc.12', '1.0.0', '2.3.1'])(
    'встановлене ядро %s → відмова «канон заморожено», нічого не записано',
    async (version) => {
      const { store, storeDir } = await oldStore(
        `rb-frozen-${version}`,
        version,
      );
      const before = snapshot(storeDir);

      const { exitCode, output } = await runCaptured(store, [
        '--write',
        '--rebaseline',
      ]);
      expect(exitCode).toBe(1);
      expect(output).toContain('канон заморожено');
      expect(snapshot(storeDir)).toEqual(before);
    },
  );

  it('версію встановленого ядра не визначено → відмова (не довести, що канон не заморожено)', async () => {
    const { store, storeDir } = await oldStore('rb-no-version', null);
    const before = snapshot(storeDir);

    const { exitCode, output } = await runCaptured(store, [
      '--write',
      '--rebaseline',
    ]);
    expect(exitCode).toBe(1);
    expect(output).toContain('версію встановленого ядра');
    expect(snapshot(storeDir)).toEqual(before);
  });

  it('без --rebaseline → зупинка з підказкою про --rebaseline і названим файлом з маніфесту', async () => {
    const { store, storeDir } = await oldStore('rb-hint');
    const before = snapshot(storeDir);

    const { exitCode, output } = await runCaptured(store, ['--write']);
    expect(exitCode).toBe(1);
    expect(output).toContain('Спільні міграції розійшлися вмістом');
    expect(output).toContain('baseline-виняток');
    expect(output).toContain('simplycms db:diff --write --rebaseline');
    expect(output).toContain('перестворити БД');
    // Власник за один прогін бачить і застарілий файл з маніфесту.
    expect(output).toContain(STALE);
    expect(snapshot(storeDir)).toEqual(before);
  });

  it('змінений файл ПЛАГІНА лишається зупинкою навіть з --rebaseline, нічого не записано', async () => {
    const { store, storeDir } = await oldStore('rb-plugin-changed');
    const file = withChangedPluginFile(store, storeDir);
    const before = snapshot(storeDir);

    const { exitCode, output } = await runCaptured(store, [
      '--write',
      '--rebaseline',
    ]);
    expect(exitCode).toBe(1);
    expect(output).toContain('Спільні міграції розійшлися вмістом');
    expect(output).toContain(file);
    // Зупинка нічого не пише — навіть заміну файлів ядра, яку ребазлайн виконав би.
    expect(snapshot(storeDir)).toEqual(before);
  });

  it('після заморожування зупинка не радить --rebaseline', async () => {
    const { store } = await oldStore('rb-hint-frozen', '1.0.0');
    const { exitCode, output } = await runCaptured(store, ['--write']);
    expect(exitCode).toBe(1);
    expect(output).toContain('Спільні міграції розійшлися вмістом');
    expect(output).not.toContain('--rebaseline');
    // Файл з маніфесту названо, але команди, що зупиниться на тому самому
    // конфлікті, поруч немає.
    expect(output).toContain(STALE);
    expect(output).not.toContain('db:diff --write');
  });

  it('змінений лише файл плагіна → зупинка без команд: файл з маніфесту названо, `db:diff --write` не радиться', async () => {
    const { store, storeDir, schemaDir } = await oldStore('rb-plugin-only');
    // Ядро в порядку, конфліктує лише плагін.
    for (const file of BASELINE)
      cpSync(join(schemaDir, file), join(storeDir, file));
    withChangedPluginFile(store, storeDir);

    const { exitCode, output } = await runCaptured(store, ['--write']);
    expect(exitCode).toBe(1);
    expect(output).toContain('Спільні міграції розійшлися вмістом');
    expect(output).toContain(STALE);
    expect(output).not.toContain('db:diff --write');
    expect(output).not.toContain('--rebaseline');
  });

  it('змінені і ядро, і плагін без --rebaseline → ребазлайн не радиться (сам зупинився б на плагіні)', async () => {
    const { store, storeDir } = await oldStore('rb-core-and-plugin');
    withChangedPluginFile(store, storeDir);

    const { exitCode, output } = await runCaptured(store, ['--write']);
    expect(exitCode).toBe(1);
    expect(output).toContain('0001_init.sql');
    expect(output).not.toContain('--rebaseline');
    expect(output).not.toContain('db:diff --write');
  });

  it('--rebaseline без --write → лише звіт, файли не змінено', async () => {
    const { store, storeDir } = await oldStore('rb-report');
    const before = snapshot(storeDir);

    const { exitCode, output } = await runCaptured(store, ['--rebaseline']);
    expect(exitCode).toBeUndefined();
    expect(snapshot(storeDir)).toEqual(before);
    for (const file of BASELINE) expect(output).toContain(file);
    expect(output).toContain(STALE);
    expect(output).toContain('базу даних треба перестворити');
    expect(output).toContain('db:diff --write --rebaseline');
  });
});
