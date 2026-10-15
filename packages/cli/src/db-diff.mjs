// simplycms db:diff [--write] — порівняння міграцій магазину з N КАНОНАМИ
// (Фаза 3, Р4): ядро (simplycms/migrations) + кожен встановлений
// плагін із конфігу, що везе migrations/ у пакеті. Нові міграції — список і
// копіювання під --write (forward-only); власні (невідомі ЖОДНОМУ канону) —
// інформаційно; спільне імʼя з різним вмістом — error і жодного запису
// (міграції immutable). Міграції плагіна перед копіюванням проходять
// SQL-лінт меж: лише таблиці plg_<name>_* (спека §7/§9). Чистий компаратор
// звідси переиспользовує doctor (перевірка №7) — реалізація одна.
// Файли, яких у каноні ядра вже немає (baseline-винятки), прибирає `--write` за
// закритим маніфестом `removed.json` — див. `removed-migrations.mjs`.
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import { join } from 'node:path';
import { configPluginEntries, stripPrefixes } from './config-edit.mjs';
import { findStoreRoot } from './context.mjs';
import { fileDiffers } from './host-drift.mjs';
import {
  REBASELINE_COMMAND,
  applyReplacement,
  refuseRebaseline,
  reportContentConflict,
} from './rebaseline.mjs';
import {
  applyRemovedCore,
  findRemovedCoreMigrations,
  readRemovedManifest,
} from './removed-migrations.mjs';
import { begin, finish, say, showSteps } from './ui.mjs';

// Окремий модуль лише через розмір цього файла; db-diff лишається єдиним
// публічним входом для компаратора міграцій (і для doctor №7).
export { findRemovedCoreMigrations, readRemovedManifest };

/** Тека міграцій магазину. */
export const storeMigrationsDir = (storeRoot) =>
  join(storeRoot, 'db', 'migrations');

/**
 * Гучна відсутність теки міграцій магазину: без неї компаратор бачить «усе
 * відсутнє» чи мовчить, і doctor/update брехали б «усе гаразд». `null` —
 * тека є; інакше текст помилки (зі старою `supabase/migrations` — з підказкою
 * `git mv`: зворотної сумісності немає, лише спосіб переїхати). `db/migrations` —
 * файл, а не тека, — теж гучна помилка, спільна для doctor, update і db:diff.
 * @param {string} storeRoot
 * @returns {string | null}
 */
export function missingStoreMigrationsDir(storeRoot) {
  const dir = storeMigrationsDir(storeRoot);
  if (existsSync(dir)) {
    // Файл замість теки: без цього перша ж `readdirSync` кидала б сирий ENOTDIR.
    return statSync(dir).isDirectory()
      ? null
      : 'db/migrations існує, але це не тека, а файл — видали його й створи теку міграцій.';
  }
  const base = 'Тека міграцій магазину db/migrations відсутня.';
  return existsSync(join(storeRoot, 'supabase', 'migrations'))
    ? `${base} Знайдено стару supabase/migrations — перенеси: git mv supabase/migrations db/migrations`
    : base;
}

/**
 * Канон міграцій встановленого ядра.
 *
 * 🔴 Саме `node_modules/simplycms/migrations` — міграції лежать на РІВНІ
 * пакета (`files: [… "migrations"]`), а не в підтеці схеми: після злиття
 * пакетів (трек К0) `src/schema/` — це код Drizzle-схеми, а SQL їде окремо.
 *
 * 🔴 Після B13 канон — це baseline + сід (`0000_prelude` … `0004_functions`), а не
 * історія з 33 файлів. Компаратор від цього не змінився: він порівнює імена
 * й вміст, а не формат імені. Змінився лише ПОРЯДОК — його тепер задає
 * числовий префікс, а не таймстамп.
 */
export const schemaMigrationsPath = (storeRoot) =>
  join(storeRoot, 'node_modules', 'simplycms', 'migrations');

/** Та сама тека, але з гучною перевіркою наявності — для команди db:diff. */
export function assertSchemaMigrations(storeRoot) {
  const dir = schemaMigrationsPath(storeRoot);
  if (!existsSync(dir))
    throw new Error(
      `Не знайдено ${dir}: встановлений пакет simplycms не везе migrations/ — ` +
        'це стара версія ядра. Онови його (pnpm simplycms update) і повтори.',
    );
  return dir;
}

/** SQL-файли теки, відсортовані; відсутня тека → порожній список. */
export const listSqlFiles = (dir) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((name) => name.endsWith('.sql'))
        .sort()
    : [];

/**
 * Чисте порівняння тек міграцій за іменами файлів: `missing` — є в ядрі,
 * немає в магазині; `own` — лише в магазині (його власні); `changed` —
 * спільне імʼя з різним вмістом (порушення immutable).
 * @param {string} storeDir
 * @param {string} schemaDir
 * @returns {{ missing: string[]; own: string[]; changed: string[] }}
 */
export function compareMigrations(storeDir, schemaDir) {
  const store = listSqlFiles(storeDir);
  const core = listSqlFiles(schemaDir);
  return {
    missing: core.filter((name) => !store.includes(name)),
    own: store.filter((name) => !core.includes(name)),
    changed: core.filter(
      (name) =>
        store.includes(name) &&
        fileDiffers(join(schemaDir, name), join(storeDir, name)),
    ),
  };
}

/**
 * Канони міграцій установлених плагінів: записи конфігу → тека migrations/
 * пакета. `@plugins/<name>` — локальний плагін магазину (тека plugins/),
 * bare-специфікатор — пакет у node_modules. Плагін без migrations/ — не
 * помилка (плагіни без таблиць легальні), його просто немає в списку.
 * @param {string} storeRoot
 * @returns {{ name: string; spec: string; dir: string }[]}
 */
export function pluginMigrationSources(storeRoot) {
  const configPath = join(storeRoot, 'simplycms.config.ts');
  if (!existsSync(configPath)) return [];
  const entries = configPluginEntries(readFileSync(configPath, 'utf8')) ?? [];
  const sources = [];
  for (const { name, spec } of entries) {
    const dir = spec.startsWith('@plugins/')
      ? join(storeRoot, 'plugins', spec.slice('@plugins/'.length), 'migrations')
      : join(storeRoot, 'node_modules', spec, 'migrations');
    // Імʼя для лінта меж — КАНОНІЧНЕ, зі специфікатора пакета, а не
    // конфіг-ключ: --name-аліас у конфізі не повинен ламати перевірку
    // «плагін чіпає лише plg_<name>_*» (знахідка рев'ю Фази 3 №1).
    const lintName = stripPrefixes(
      spec.startsWith('@plugins/') ? spec.slice('@plugins/'.length) : spec,
    );
    if (existsSync(dir)) sources.push({ name, spec, dir, lintName });
  }
  return sources;
}

/**
 * Порівняння магазину з N канонами (ядро + плагіни). `own` рахується по
 * ОБʼЄДНАННЮ канонів — інакше міграція плагіна, вже скопійована в магазин,
 * брехливо значилась би «власною». `collisions` — одне імʼя з різним вмістом
 * у ДВОХ канонах: конфлікт джерел, який не розвʼязується копіюванням.
 * @param {string} storeDir
 * @param {{ name: string | null; spec: string; dir: string }[]} sources
 */
export function compareMigrationsMulti(storeDir, sources) {
  const store = listSqlFiles(storeDir);
  /** @type {Map<string, string>} імʼя → тека канону, що принесла його першою */
  const seen = new Map();
  const collisions = [];
  const perSource = sources.map(({ name, spec, dir }) => {
    const files = listSqlFiles(dir);
    for (const file of files) {
      const firstDir = seen.get(file);
      if (firstDir === undefined) seen.set(file, dir);
      else if (fileDiffers(join(firstDir, file), join(dir, file)))
        collisions.push(file);
    }
    return {
      name,
      spec,
      dir,
      missing: files.filter((file) => !store.includes(file)),
      changed: files.filter(
        (file) =>
          store.includes(file) &&
          fileDiffers(join(dir, file), join(storeDir, file)),
      ),
    };
  });
  return {
    perSource,
    own: store.filter((file) => !seen.has(file)),
    collisions,
  };
}

/**
 * SQL-лінт межі довіри (спека §7/§9): міграція плагіна сміє чіпати ЛИШЕ
 * власні таблиці `plg_<name>_*` — включно з політиками, індексами та
 * REFERENCES (link-поля без FK у чужі таблиці). Regexp-скан свідомо простий:
 * це гард від помилки автора, а не парсер SQL; хитрий обхід зупинить ревʼю
 * міграції людиною (обовʼязковий крок конвеєра).
 * @param {string} sql
 * @param {string} pluginName
 * @returns {string[]} людські описи порушень; порожньо — чисто
 */
export function lintPluginMigrationSql(sql, pluginName) {
  const prefix = `plg_${pluginName.replace(/-/g, '_')}_`;
  // Схема може бути в лапках (`"public"."plg_x"` — стиль виводу діфф-інструментів),
  // імʼя — теж; коментарі прибираються ДО скану, інакше `-- references
  // products` у прозі давав би хибне порушення.
  const stripped = sql
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const ident = String.raw`(?:"?public"?\.)?"?([A-Za-z_][A-Za-z0-9_]*)"?`;
  const targets = [
    new RegExp(
      String.raw`create\s+table\s+(?:if\s+not\s+exists\s+)?${ident}`,
      'gi',
    ),
    new RegExp(
      String.raw`alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?${ident}`,
      'gi',
    ),
    new RegExp(
      String.raw`(?:create|drop)\s+policy\s+(?:if\s+exists\s+)?"[^"]+"\s+on\s+${ident}`,
      'gi',
    ),
    new RegExp(
      String.raw`create\s+(?:unique\s+)?index\s+(?:if\s+not\s+exists\s+)?\S+\s+on\s+${ident}`,
      'gi',
    ),
    new RegExp(String.raw`drop\s+table\s+(?:if\s+exists\s+)?${ident}`, 'gi'),
    new RegExp(String.raw`references\s+${ident}`, 'gi'),
    // Тригер сміє висіти лише на власній таблиці плагіна.
    new RegExp(
      String.raw`create\s+(?:or\s+replace\s+)?trigger\s+\S+[\s\S]*?\bon\s+${ident}`,
      'gi',
    ),
    // Функції: перевизначення чужої (типово — is_admin()) — дешевий
    // привілейований обхід; власні функції плагіна — теж під префіксом.
    new RegExp(
      String.raw`create\s+(?:or\s+replace\s+)?function\s+${ident}`,
      'gi',
    ),
    new RegExp(String.raw`drop\s+function\s+(?:if\s+exists\s+)?${ident}`, 'gi'),
  ];
  const violations = [];
  for (const re of targets) {
    for (const match of stripped.matchAll(re)) {
      if (!match[1].startsWith(prefix)) {
        violations.push(
          `"${match[1]}" поза межею ${prefix}* (${match[0].trim().slice(0, 50)}…)`,
        );
      }
    }
  }
  return violations;
}

/** Докопіювати названі міграції ядра в магазин (тільки додавання, §4.4). */
export function copyMigrations(storeDir, schemaDir, names) {
  mkdirSync(storeDir, { recursive: true });
  for (const name of names) cpSync(join(schemaDir, name), join(storeDir, name));
}

/** @param {string[]} argv */
export function parseDbDiffArgs(argv) {
  let write = false;
  let rebaseline = false;
  for (const arg of argv) {
    if (arg === '--write') write = true;
    else if (arg === '--rebaseline') rebaseline = true;
    else throw new Error(`Невідомий аргумент db:diff: ${arg}`);
  }
  return { write, rebaseline };
}

/** @param {string[]} argv */
export async function run(argv) {
  const { write, rebaseline } = parseDbDiffArgs(argv);
  begin('simplycms db:diff');
  const storeRoot = findStoreRoot();
  // 🔴 До будь-якої генерації: інакше `--write` через `copyMigrations`
  // (`mkdir -p`) мовчки створив би нову `db/migrations` — зокрема в магазині,
  // що ще лежить на старій `supabase/migrations`.
  const missingDir = missingStoreMigrationsDir(storeRoot);
  if (missingDir) {
    say.error(missingDir);
    process.exitCode = 1;
    finish('Тека міграцій магазину відсутня.');
    return;
  }
  const storeDir = storeMigrationsDir(storeRoot);

  // Канони: ядро (обовʼязкове) + плагіни з конфігу, що везуть migrations/.
  const sources = [
    {
      name: null,
      spec: 'simplycms',
      dir: assertSchemaMigrations(storeRoot),
    },
    ...pluginMigrationSources(storeRoot),
  ];
  const coreDir = sources[0].dir;
  // Ребазлайн після заморожування канону — відмова до будь-якого читання чи запису.
  if (rebaseline && refuseRebaseline(coreDir)) return;
  const { perSource, own, collisions } = compareMigrationsMulti(
    storeDir,
    sources,
  );
  // Маніфест читається ДО будь-якого запису: зіпсований — гучна помилка.
  const manifest = readRemovedManifest(coreDir);
  const removed = findRemovedCoreMigrations(storeDir, manifest);
  const matched = removed.filter((r) => r.status === 'match');

  if (collisions.length > 0) {
    say.error(
      `Одне імʼя міграції з різним вмістом у двох канонах: ${collisions.join(', ')}.\n` +
        'Конфлікт джерел не розвʼязується копіюванням — нічого не записано.',
    );
    process.exitCode = 1;
    finish('Колізія канонів міграцій.');
    return;
  }

  // З --rebaseline змінені файли ЯДРА — не конфлікт, а план заміни; змінені
  // файли плагінів (immutable) лишаються зупинкою.
  const replace = rebaseline ? perSource[0].changed : [];
  const changed = perSource.flatMap((s, i) =>
    rebaseline && i === 0 ? [] : s.changed,
  );
  if (changed.length > 0) {
    reportContentConflict({
      changed,
      coreChanged: perSource[0].changed,
      rebaseline,
      coreDir,
      manifest,
      removed,
    });
    process.exitCode = 1;
    finish('Конфлікт вмісту міграцій.');
    return;
  }

  // SQL-лінт меж для міграцій ПЛАГІНІВ (ядро свої канони не лінтить —
  // воно і є ядро). Порушення — error без запису, --write чи ні.
  let linted = true;
  for (const source of perSource) {
    if (source.name === null) continue;
    for (const file of source.missing) {
      const violations = lintPluginMigrationSql(
        readFileSync(join(source.dir, file), 'utf8'),
        source.lintName ?? source.name,
      );
      if (violations.length > 0) {
        linted = false;
        say.error(
          `Міграція ${file} плагіна '${source.name}' порушує межу довіри:\n  ${violations.join('\n  ')}`,
        );
      }
    }
  }
  if (!linted) {
    process.exitCode = 1;
    finish('Міграції плагінів не пройшли лінт меж — нічого не записано.');
    return;
  }

  // Файл з маніфесту канон «не знає», але він не власний — його звітує
  // окремий блок нижче; у «власних» він збивав би з пантелику.
  const ownVisible = own.filter((f) => !removed.some((r) => r.name === f));
  if (ownVisible.length > 0)
    say.info(
      `Власні міграції магазину (жоден канон їх не знає): ${ownVisible.join(', ')}`,
    );

  const totalMissing = perSource.reduce((n, s) => n + s.missing.length, 0);
  if (totalMissing === 0 && removed.length === 0 && replace.length === 0) {
    say.success('Нових міграцій немає — магазин не відстає від канонів.');
    finish('Вже зроблено.');
    return;
  }

  // Порядок проходу: прибрати файли з маніфесту → замінити змінені файли ядра
  // вмістом канону (лише --rebaseline) → докопіювати відсутні.
  const { refused } = applyRemovedCore({
    storeDir,
    manifest,
    found: removed,
    write,
    // У режимі ребазлайну звичайний `--write` зупинився б на зміненому baseline.
    fix: rebaseline ? `pnpm ${REBASELINE_COMMAND}` : undefined,
  });
  if (replace.length > 0)
    applyReplacement({ storeDir, coreDir, names: replace, write });
  for (const source of perSource) {
    if (source.missing.length === 0) continue;
    const label = source.name === null ? 'ядра' : `плагіна '${source.name}'`;
    if (!write) {
      say.warn(
        `Нові міграції ${label} (${source.missing.length}): ${source.missing.join(', ')}`,
      );
    } else {
      copyMigrations(storeDir, source.dir, source.missing);
      say.success(
        `Скопійовано ${source.missing.length} міграцій ${label}: ${source.missing.join(', ')}`,
      );
    }
  }

  // `--write` має що зробити, лише якщо є що копіювати або що прибрати без
  // відмови; один лише змінений файл потребує ручної дії, а не `--write`.
  const actionable = [
    totalMissing > 0 && 'скопіювати нові міграції в db/migrations/',
    matched.length > 0 && 'прибрати файли, видалені з канону ядра',
    replace.length > 0 && 'замінити змінені файли ядра вмістом канону',
  ].filter(Boolean);
  if (!write) {
    if (actionable.length > 0) {
      showSteps([
        `pnpm simplycms db:diff --write${replace.length > 0 ? ' --rebaseline' : ''}   # ${actionable.join(' і ')}`,
      ]);
      finish('Є що забрати (--write).');
    } else {
      finish('Є файл, прибраний з канону ядра, — потрібна ручна дія.');
    }
    return;
  }
  if (refused.length > 0) {
    // Відмова — не «готово»: застарілий файл і далі ламатиме накат.
    process.exitCode = 1;
    finish(
      'Файли, прибрані з канону й змінені в магазині, треба видалити вручну.',
    );
    return;
  }
  // Накат — команда самого CLI (ядро `simplycms/migrate`, журнал сум): після
  // людського ревʼю SQL, у порядку імен, лише файли без запису в журналі.
  showSteps([
    'git diff                        # ревʼю доданих, замінених і прибраних міграцій',
    ...(replace.length > 0
      ? [
          'перестворити базу даних         # порожня БД (локально) або новий екземпляр (сервер)',
        ]
      : []),
    'pnpm simplycms db:apply         # накат (MIGRATION_DATABASE_URL — власник схеми)',
  ]);
  finish('Готово.');
}
