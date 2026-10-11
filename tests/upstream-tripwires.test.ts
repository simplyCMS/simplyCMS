import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { installedVersion, readInstalledFile } from './lib/installed-package';

/**
 * Розтяжки upstream: реєстр `docs/architecture/upstream-workarounds.md` —
 * ЄДИНИЙ список обходів, а цей файл — його виконуваний бік.
 *
 * Навіщо. Обхід живе довше за контекст, у якому його знайшли; реєстр каже
 * «звіряй при бампі», але людина забуває. Тут передумова кожного обходу, яку
 * можна прочитати статично (текст встановленого модуля, версія, SQL білдера),
 * зведена в тест: бамп, що її змінює, червоніє САМ, а не коли хтось згадає.
 * Уроки Е6д: Start вирішує форму через `includes(…)` + `formData()` (стеля
 * тіла дзеркалить цей предикат), а `insert().values()` називає ВСІ колонки
 * (колонковий INSERT-грант дав 42501).
 *
 * Без другого списку. Парність звіряє код із РЕЄСТРОМ в обидва боки:
 *   • маркер `UPSTREAM:<ID>` у коді ⇒ запис активний у реєстрі (закритий
 *     запис чи вигаданий ID — червоний);
 *   • активний запис ⇒ або тут є розтяжка (і запис її називає рядком
 *     `| Розтяжка |`), або сам запис несе `| Розтяжка: немає | <причина> |`;
 *   • активний запис без маркерів у коді ⇒ `| Маркери: немає | <причина> |`.
 * Виняток «статично не перевірити» живе в записі реєстру, не тут.
 *
 * Повідомлення червоного: «UPSTREAM:<ID> — поведінка бібліотеки змінилась».
 * Кожна передумова — чиста функція від тексту й має негативний контроль
 * (підміна рядка → червоний), інакше «зелений» міг би означати «шукає не те».
 */

const ROOT = resolve(import.meta.dirname, '..');
const REGISTRY_PATH = join(ROOT, 'docs/architecture/upstream-workarounds.md');
const TRIPWIRE_FILE = 'tests/upstream-tripwires.test.ts';

const hint = (id: string, what: string): string =>
  `UPSTREAM:${id} — поведінка бібліотеки змінилась: переглянь запис у upstream-workarounds.md (${what})`;

// ---------- передумови: чисті функції від тексту; порожній масив = тримається ----------

/** Повертає перелік порушених передумов. */
type Premise = (src: string) => string[];

const need =
  (checks: Record<string, (src: string) => boolean>): Premise =>
  (src) =>
    Object.entries(checks)
      .filter(([, ok]) => !ok(src))
      .map(([what]) => what);

const startBody: Premise = need({
  "предикат форми через includes('multipart/form-data')": (s) =>
    /FORM_DATA_CONTENT_TYPES\s*=\s*\[[^\]]*"multipart\/form-data"/.test(s) &&
    /contentType\.includes\(type\)/.test(s),
  "предикат форми через includes('application/x-www-form-urlencoded')": (s) =>
    /FORM_DATA_CONTENT_TYPES\s*=\s*\[[^\]]*"application\/x-www-form-urlencoded"/.test(
      s,
    ),
  'тіло форми читається await request.formData()': (s) =>
    /await request\.formData\(\)/.test(s),
});

/** START-1: `formData()` викликається ДО виклику хендлера (`action(`). */
const startFormBeforeHandler: Premise = (src) => {
  const form = src.indexOf('await request.formData()');
  const action = src.indexOf('await action(', form);
  return form >= 0 && action > form
    ? []
    : ['formData() більше не передує виклику хендлера'];
};

/** START-BODY-1: шлях serverFn береться з TSS_SERVER_FN_BASE (стеля тіла читає ту саму змінну). */
const startFnBase: Premise = need({
  'RPC-клієнт будує URL з process.env.TSS_SERVER_FN_BASE': (s) =>
    /process\.env\.TSS_SERVER_FN_BASE\s*\+/.test(s),
});

const shallowError: Premise = need({
  'плагін тегу $TSR/Error досі існує': (s) => s.includes('"$TSR/Error"'),
  'parse віддає лише message': (s) =>
    /parse:\s*\{[\s\S]*?return \{ message: ctx\.parse\(value\.message\) \}/.test(
      s,
    ),
  'deserialize відновлює голий new Error(message)': (s) =>
    /new Error\(ctx\.deserialize\(node\.message\)\)/.test(s),
});

const parseSubsetNoOffset: Premise = (src) => {
  const start = src.indexOf('function parseLoadSubsetOptions');
  const end = src.indexOf('\nexport', start);
  if (start < 0) return ['parseLoadSubsetOptions зник'];
  return /offset/.test(src.slice(start, end))
    ? ['parseLoadSubsetOptions уже повертає offset']
    : [];
};

const subsetOptionsNotReexported: Premise = (src) =>
  /\bLoadSubsetOptions\b/.test(src)
    ? ['index.d.ts уже згадує LoadSubsetOptions']
    : [];

const drizzleWrapsCause: Premise = need({
  'pg-session кидає DrizzleQueryError(query, params, e)': (s) =>
    s.includes('throw new DrizzleQueryError(queryString, params, e)'),
});
const drizzleErrorCause: Premise = need({
  'DrizzleQueryError кладе драйверну помилку в .cause': (s) =>
    /constructor\(query, params, cause\)[\s\S]*this\.cause = cause/.test(s),
});

const tsEslintPeer: Premise = (src) => {
  const range = (
    JSON.parse(src) as { peerDependencies?: Record<string, string> }
  ).peerDependencies?.typescript;
  return range?.includes('<6.1.0') ? [] : [`peer typescript тепер «${range}»`];
};

/** DRIZ-1: версія ORM — рішення «чекати stable 1.0»; мажор змінився — час переглянути. */
const drizzleStillZeroX: Premise = (src) =>
  /^0\./.test(src.trim()) ? [] : [`drizzle-orm тепер ${src.trim()}`];

/** DRZ-INSERT-1: SQL вставки називає колонку, якої немає в `values()` (вона піде як default). */
const insertNamesDefaultedColumns: Premise = (sql) =>
  /"note"/.test(sql) && /default/i.test(sql)
    ? []
    : [`SQL вставки не називає колонку з default: ${sql}`];

function buildInsertSql(): string {
  const t = pgTable('tripwire_t', {
    id: uuid('id').notNull(),
    note: text('note').default('x'),
  });
  return drizzle
    .mock()
    .insert(t)
    .values({ id: '00000000-0000-4000-8000-000000000000' })
    .toSQL().sql;
}

// ---------- розтяжки: ID реєстру → як прочитати встановлений модуль ----------

type Tripwire = { read: () => string; premise: Premise }[];

const SSC = ['@tanstack/react-start', '@tanstack/start-server-core'];
const HANDLER = 'dist/esm/server-functions-handler.js';

const TRIPWIRES: Record<string, Tripwire> = {
  'START-BODY-1': [
    { read: () => readInstalledFile(SSC, HANDLER), premise: startBody },
    {
      read: () => readInstalledFile(SSC, 'dist/esm/createServerRpc.js'),
      premise: startFnBase,
    },
  ],
  'START-1': [
    {
      read: () => readInstalledFile(SSC, HANDLER),
      premise: startFormBeforeHandler,
    },
  ],
  'START-2': [
    {
      read: () =>
        readInstalledFile(
          ['@tanstack/react-start', '@tanstack/router-core'],
          'dist/esm/ssr/serializer/ShallowErrorPlugin.js',
        ),
      premise: shallowError,
    },
  ],
  'TSDB-3': [
    {
      read: () =>
        readInstalledFile(
          ['@tanstack/query-db-collection', '@tanstack/db'],
          'dist/esm/query/expression-helpers.js',
        ),
      premise: parseSubsetNoOffset,
    },
  ],
  'TSDB-4': [
    {
      read: () =>
        readInstalledFile(
          ['@tanstack/query-db-collection'],
          'dist/esm/index.d.ts',
        ),
      premise: subsetOptionsNotReexported,
    },
  ],
  'DRZ-1': [
    {
      read: () => readInstalledFile(['drizzle-orm'], 'pg-core/session.js'),
      premise: drizzleWrapsCause,
    },
    {
      read: () => readInstalledFile(['drizzle-orm'], 'errors.js'),
      premise: drizzleErrorCause,
    },
  ],
  'DRZ-INSERT-1': [
    { read: buildInsertSql, premise: insertNamesDefaultedColumns },
  ],
  'TSESL-1': [
    {
      read: () => readInstalledFile(['typescript-eslint'], 'package.json'),
      premise: tsEslintPeer,
    },
  ],
  'DRIZ-1': [
    {
      read: () => installedVersion(['drizzle-orm']),
      premise: drizzleStillZeroX,
    },
  ],
};

describe('розтяжки upstream: передумова обходу досі тримається', () => {
  for (const [id, parts] of Object.entries(TRIPWIRES)) {
    it(`UPSTREAM:${id}`, () => {
      const broken = parts.flatMap((p) => p.premise(p.read()));
      expect(broken, hint(id, broken.join('; '))).toEqual([]);
    });
  }
});

describe('негативний контроль: підмінений текст-передумова червоніє', () => {
  const handler = readInstalledFile(SSC, HANDLER);

  it('START-BODY-1: предикат форми без includes(multipart) / без formData()', () => {
    expect(startBody(handler)).toEqual([]);
    expect(
      startBody(handler.replace('"multipart/form-data"', '"multipart/mixed"')),
    ).not.toEqual([]);
    expect(
      startBody(
        handler.replaceAll('await request.formData()', 'await request.text()'),
      ),
    ).not.toEqual([]);
  });

  it('START-BODY-1: базовий шлях без TSS_SERVER_FN_BASE', () => {
    const rpc = readInstalledFile(SSC, 'dist/esm/createServerRpc.js');
    expect(
      startFnBase(rpc.replaceAll('TSS_SERVER_FN_BASE', 'SOMETHING_ELSE')),
    ).not.toEqual([]);
  });

  it('START-1: formData() після хендлера', () => {
    expect(startFormBeforeHandler(handler)).toEqual([]);
    expect(
      startFormBeforeHandler('await action(p); await request.formData();'),
    ).not.toEqual([]);
  });

  it('START-2: parse починає віддавати name', () => {
    const src = readInstalledFile(
      ['@tanstack/react-start', '@tanstack/router-core'],
      'dist/esm/ssr/serializer/ShallowErrorPlugin.js',
    );
    expect(shallowError(src)).toEqual([]);
    expect(
      shallowError(
        src.replaceAll(
          '{ message: ctx.parse(value.message) }',
          '{ message: 1, name: 2 }',
        ),
      ),
    ).not.toEqual([]);
  });

  it('TSDB-3: parseLoadSubsetOptions повертає offset', () => {
    const src =
      'function parseLoadSubsetOptions(o) { return { limit: o.limit, offset: o.offset }; }\nexport {}';
    expect(parseSubsetNoOffset(src)).not.toEqual([]);
  });

  it('TSDB-4: тип реекспортовано', () => {
    expect(
      subsetOptionsNotReexported(
        'export type { LoadSubsetOptions } from "@tanstack/db";',
      ),
    ).not.toEqual([]);
  });

  it('DRZ-1: сесія не обгортає помилку', () => {
    expect(drizzleWrapsCause('throw e;')).not.toEqual([]);
    expect(drizzleErrorCause('constructor(query, params) {}')).not.toEqual([]);
  });

  it('TSESL-1: peer розширено до TS 7', () => {
    const pkg = JSON.stringify({
      peerDependencies: { typescript: '>=4.8.4 <7.1.0' },
    });
    expect(tsEslintPeer(pkg)).not.toEqual([]);
  });

  it('DRIZ-1: вийшов drizzle-orm 1.x', () => {
    expect(drizzleStillZeroX('1.0.0')).not.toEqual([]);
  });

  it('DRZ-INSERT-1: SQL без колонки з default', () => {
    expect(insertNamesDefaultedColumns(buildInsertSql())).toEqual([]);
    expect(
      insertNamesDefaultedColumns('insert into "t" ("id") values ($1)'),
    ).not.toEqual([]);
  });
});

// ---------- парність код ↔ реєстр ----------

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  '.claude',
  'docs',
  'coverage',
  '.output',
]);
const SOURCE_EXT = /\.(?:ts|tsx|mts|cts|js|mjs|cjs)$/;
const MARKER = /UPSTREAM:([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-[A-Z0-9]*\d)/g;

/** Усі маркери `UPSTREAM:<ID>` у коді (без самого цього файлу — він цитує ID). */
function codeMarkers(): Set<string> {
  const found = new Set<string>();
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) walk(join(dir, e.name));
      } else if (SOURCE_EXT.test(e.name)) {
        const file = join(dir, e.name);
        if (relative(ROOT, file).replaceAll('\\', '/') === TRIPWIRE_FILE)
          continue;
        for (const m of readFileSync(file, 'utf8').matchAll(MARKER))
          found.add(m[1] as string);
      }
    }
  };
  walk(ROOT);
  return found;
}

/** Активні записи реєстру: ID → текст запису (секція `###` або рядок таблиці «на що спираємося»). */
export function activeRecords(registry: string): Map<string, string> {
  const start = registry.indexOf('\n## Активні');
  const end = registry.indexOf('\n## Закриті');
  const active = registry.slice(start, end);
  const out = new Map<string, string>();
  for (const part of active.split(/^### /m).slice(1)) {
    const id = /^([A-Z][A-Z0-9-]*\d)\b/.exec(part)?.[1];
    if (id) out.set(id, part);
  }
  for (const row of active.matchAll(/^\| ([A-Z][A-Z0-9-]*\d) \|.*$/gm)) {
    out.set(row[1] as string, row[0]);
  }
  return out;
}

/** Порушення парності: чиста функція від реєстру, маркерів коду й набору розтяжок. */
export function parityProblems(
  registry: string,
  markers: ReadonlySet<string>,
  tripwireIds: readonly string[],
): string[] {
  const records = activeRecords(registry);
  const problems: string[] = [];
  for (const id of markers) {
    if (!records.has(id))
      problems.push(
        `маркер UPSTREAM:${id} у коді без активного запису в реєстрі`,
      );
  }
  for (const id of tripwireIds) {
    if (!records.has(id))
      problems.push(`розтяжка ${id} без активного запису (мертва)`);
  }
  for (const [id, text] of records) {
    const hasTripwire = tripwireIds.includes(id);
    const namesTripwire = text.includes(TRIPWIRE_FILE);
    const exempt = /\| Розтяжка: немає \| \S[^|]*\|/.test(text);
    if (hasTripwire && !namesTripwire)
      problems.push(`${id}: розтяжка є, запис її не називає`);
    if (hasTripwire && exempt)
      problems.push(`${id}: і розтяжка, і «Розтяжка: немає»`);
    if (!hasTripwire && !exempt)
      problems.push(`${id}: ні розтяжки, ні «| Розтяжка: немає | <причина> |»`);
    if (!hasTripwire && namesTripwire && !exempt)
      problems.push(`${id}: запис називає розтяжку, якої немає`);
    if (!markers.has(id) && !/\| Маркери: немає \| \S[^|]*\|/.test(text)) {
      problems.push(
        `${id}: немає маркерів у коді і немає «| Маркери: немає | <причина> |»`,
      );
    }
    if (markers.has(id) && /\| Маркери: немає \|/.test(text)) {
      problems.push(`${id}: маркери в коді є, а запис каже «Маркери: немає»`);
    }
  }
  return problems;
}

describe('парність реєстру обходів і коду', () => {
  const registry = readFileSync(REGISTRY_PATH, 'utf8');
  const markers = codeMarkers();
  const ids = Object.keys(TRIPWIRES);

  it('реєстр і код узгоджені в обидва боки', () => {
    expect(parityProblems(registry, markers, ids)).toEqual([]);
  });

  it('негативний контроль: вигаданий маркер у коді червоніє', () => {
    expect(
      parityProblems(registry, new Set([...markers, 'FAKE-9']), ids),
    ).not.toEqual([]);
  });

  it('негативний контроль: розтяжка без запису червоніє', () => {
    expect(parityProblems(registry, markers, [...ids, 'FAKE-9'])).not.toEqual(
      [],
    );
  });

  it('негативний контроль: запис без розтяжки й без винятку червоніє', () => {
    const stripped = registry.replace(/^\| Розтяжка: немає \|.*\n/m, '');
    expect(stripped).not.toBe(registry);
    expect(parityProblems(stripped, markers, ids)).not.toEqual([]);
  });

  it('негативний контроль: закритий запис не рахується активним', () => {
    expect(activeRecords(registry).has('DZOD-1')).toBe(false);
    expect(
      parityProblems(registry, new Set([...markers, 'DZOD-1']), ids),
    ).not.toEqual([]);
  });
});
