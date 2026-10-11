import { readdirSync, readFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Символи в доках існують у коді.
 *
 * Навіщо. Дока, що називає `eraseMedia` чи `isSafeCssValue` ПІСЛЯ їхнього зносу,
 * бреше мовчки: рев'ю звіряє дифф із планом, а не доки з кодом (уроки Е6д —
 * `deleteMedia` лишився в доках без жодного споживача). Тест бере кожен
 * ідентифікатор у зворотних лапках, схожий на символ коду, і вимагає, щоб він
 * ВИЗНАЧАВСЯ у продакшн-коді.
 *
 * Що сканується: markdown у `docs/architecture` і `docs/development`,
 * `packages/<pkg>/README.md`, README усередині `packages/simplycms/src` та
 * `packages/simplycms/skills`. Архів (`CHANGELOG.md`, `docs/superpowers`) — поза
 * скануванням. Блоки коду (три зворотні лапки) пропускаються — це приклади.
 *
 * «Схожий на символ»: `camelCase` / `PascalCase` з великою літерою всередині або
 * `UPPER_SNAKE`, у лапках цілком, опційно з `()`.
 *
 * Індекс — ВИЗНАЧЕННЯ, а не згадки: після зняття коментарів і вмісту рядків
 * береться `function/class/const/let/var/type/interface/enum`, ключі
 * об'єктів-реєстрів і властивості типів, методи, деструктуризація й
 * `export {…}`, змінні `env.X`, імена файлів-модулів, ключі JSON, іменовані
 * імпорти зі сторонніх пакетів (API бібліотеки, яке код справді кличе).
 * Файли тестів/харнеса/моків дають лише експорти й `UPPER_SNAKE`-константи
 * (гейти, на які посилаються доки); їхні назви тестів і коментарі —
 * ніколи: саме так `deleteMedia` лишався «живим» після зносу.
 *
 * ЯВНИЙ маркер історичної згадки діє на КОНКРЕТНИЙ символ: дужка `(знесено)`
 * або `(замінено …)` мусить стояти БЕЗПОСЕРЕДНЬО після символу в лапках —
 * «`adminLifecycle` (знесено)». Маркер деінде в рядку нічого не гасить.
 *
 * Шум — `DOC_SYMBOL_ALLOWLIST` (символ → причина): сторонні API, приклади,
 * заплановане. Список лише скорочується: запис, символ якого з'явився в коді
 * або зник із доків, червоніє (мертвий запис).
 */

const ROOT = resolve(import.meta.dirname, '..');

/**
 * Маркер історичної згадки: `(знесено…)` / `(замінено…)` БЕЗПОСЕРЕДНЬО після
 * символу в лапках (через пробіли). Діє на цей символ, а не на весь рядок.
 */
const HISTORICAL_AFTER = /^\s*\((?:знесено|замінено)/;

export const DOC_SYMBOL_ALLOWLIST: Readonly<Record<string, string>> = {
  // --- Next.js / Vendure / інші продукти, згадані як порівняння ---
  revalidatePath: 'Next.js API: дока пояснює, що ISR у нас немає',
  defineDashboardExtension: 'Vendure API у порівняльній таблиці платформ',
  AdminApp:
    'аналітичний документ напрямів: варіант з пакетом адмінки, якого немає',
  // --- TanStack / Vite / Playwright / Vitest ---
  routeFileIgnorePattern:
    'опція плагіна TanStack Router; в аналітичному документі напрямів',
  getCookies: 'утиліта h3/TanStack Start; в аналітичному документі напрямів',
  // --- Supabase (історичні розділи контурів) ---
  generateLink: 'Supabase Auth admin API у розділі про обхід листа',
  API_URL: 'ключ виводу `supabase status -o json` у історичному розділі',
  PUBLISHABLE_KEY:
    'ключ виводу `supabase status -o json` у історичному розділі',
  ERR_CONNECTION_REFUSED: 'код помилки браузера, цитата симптому',
  // --- npm / pnpm / CI ---
  NPM_TOKEN: 'secret GitHub Actions, не код репо',
  NODE_AUTH_TOKEN: 'змінна оточення npm/setup-node',
  ERR_PNPM_OUTDATED_LOCKFILE: 'код помилки pnpm, цитата',
  ERR_PNPM_NO_MATURE_MATCHING_VERSION: 'код помилки pnpm, цитата',
  onlyBuiltDependencies: 'ключ pnpm, згаданий як попередник `allowBuilds`',
  minimumReleaseAgeExclude: 'ключ pnpm, який дописує сама pnpm',
  maxRequestBodyBytes: 'опція Traefik (проксі перед магазином)',
  // --- Drizzle / drizzle-zod ---
  $inferInsert: 'властивість Drizzle-таблиці',
  entityKind: 'символ Drizzle, на якому ламаються подвійні копії',
  xIn: 'узагальнена позначка пари `insertIn`/`updateIn`/`removeIn` у поясненні',
  // --- @tanstack/db, query-db-collection (внутрішні імена бібліотеки в записах реєстру) ---
  removeQueries: 'метод TanStack Query, у записі TSDB-1',
  loadOrderedPrefixRepair: 'внутрішнє імʼя @tanstack/db, у записі TSDB-1',
  handleDeprecatedAutoRefetch:
    'внутрішнє імʼя query-db-collection, у записі TSDB-1',
  loadPage: 'внутрішнє імʼя @tanstack/db, у записі TSDB-2',
  startSyncIfIdle:
    'внутрішнє імʼя query-db-collection, у закритому записі TSDB-B1',
  withCollectionSyncConfigFactory:
    'внутрішнє імʼя query-db-collection, у закритому записі TSDB-B1',
  createWriteUtils:
    'внутрішнє імʼя query-db-collection, у закритому записі TSDB-B1',
  ensureContext:
    'внутрішнє імʼя query-db-collection, у закритому записі TSDB-B1',
  SyncContext: 'внутрішній тип query-db-collection, у закритому записі TSDB-B1',
  // --- TypeScript / typescript-eslint / tsdown ---
  ignoreDeprecations: 'опція tsconfig, у записі TSESL-1',
  TYPESCRIPT_ESLINT_NATIVE_BACKEND:
    'змінна оточення typescript-eslint, у записі TSESL-1',
  TypeChecker: 'тип TypeScript API, у записі TSESL-1',
  projectService: 'опція typescript-eslint, у записі TSESL-1',
  resolveDepSubpath: 'опція tsdown, у записі TSDOWN-1',
  // --- Claude Code ---
  PreToolUse: 'подія хука Claude Code',
  PostToolUse: 'подія хука Claude Code',
  SessionStart: 'подія хука Claude Code',
  SubagentStart: 'подія хука Claude Code',
  // --- API бібліотек і платформи, які код не імпортує поіменно ---
  allowBuilds: 'ключ pnpm-workspace, нова назва `onlyBuiltDependencies`',
  minimumReleaseAge: 'ключ pnpm-workspace',
  setQueryData: 'метод TanStack Query QueryClient',
  toISOString: 'метод Date (стандартна бібліотека)',
  multipleOf: 'ключ JSON Schema / Zod',
  NaN: 'глобал JavaScript',
  safeParse: 'метод схеми Zod',
  dangerouslySetInnerHTML: 'проп React',
  suppressHydrationWarning: 'проп React',
  transpileModule: 'метод TypeScript API',
  FormData: 'вебплатформний клас',
  formData: 'метод Request (вебплатформа)',
  localStorage: 'вебплатформний глобал',
  IntersectionObserver: 'вебплатформний глобал',
  scrollWidth: 'властивість DOM-елемента',
  innerText: 'властивість DOM-елемента / метод Playwright',
  isVisible: 'метод Playwright Locator (описано заборону миттєвих перевірок)',
  waitFor: 'утиліта Testing Library',
  expectTypeOf: 'утиліта Vitest',
  globalSetup: 'опція Playwright/Vitest',
  createPluginSetupTasks: 'внутрішнє імʼя Playwright',
  execValidator: 'внутрішнє імʼя Start (start-client-core)',
  extractSimpleComparisons: 'внутрішнє імʼя @tanstack/db',
  normalizeThrown: 'внутрішнє імʼя @tanstack/db (записи реєстру)',
  writeInsert: 'утиліта query-db-collection (записи реєстру)',
  writeUpsert: 'утиліта query-db-collection (записи реєстру)',
  writeDelete: 'утиліта query-db-collection (записи реєстру)',
  writeBatch: 'утиліта query-db-collection (записи реєстру)',
  updateCacheData: 'внутрішнє імʼя query-db-collection (записи реєстру)',
  gcTime: 'опція TanStack Query',
  SyncNotInitializedError: 'клас помилки @tanstack/db (записи реєстру)',
  getSerovalPlugins: 'внутрішнє імʼя Start (запис START-1)',
  getDefaultSerovalPlugins: 'внутрішнє імʼя Start (запис START-1)',
  defaultSerovalPlugins: 'внутрішнє імʼя Start (запис START-1)',
  makeSerovalPlugin: 'внутрішнє імʼя Start (запис START-1)',
  ShallowErrorPlugin: 'внутрішнє імʼя Start/seroval (запис START-1)',
  toCrossJSONAsync: 'API seroval (запис START-1)',
  fromCrossJSON: 'API seroval (запис START-1)',
  SelectedFields: 'тип Drizzle (запис DRZ-*)',
  $inferSelect: 'властивість Drizzle-таблиці',
  PgTableWithColumns: 'тип Drizzle (запис DRZ-*)',
  DrizzleQueryError: 'клас помилки Drizzle (запис реєстру)',
  isAlreadyPublished: 'внутрішня перевірка pnpm publish',
  inviteUserByEmail: 'Supabase Auth admin API в історичному розділі',
  FAILED_TO_CREATE_SESSION: 'код помилки Better Auth',
  INVALID_ORIGIN: 'код помилки Better Auth',
  TSR_ROUTES_BY_ID_MAP: 'змінна, яку генерує TanStack Router',
  srcDirectory: 'опція плагіна TanStack Start',
  ERR_PNPM_FETCH_404: 'код помилки pnpm, цитата',
  ERR_PNPM_IGNORED_BUILDS: 'код помилки pnpm, цитата',
  CollectionPage: 'тип schema.org у скілі редизайну',
  ItemList: 'тип schema.org у скілі редизайну',
  setDefault:
    'назва операції в прозі (сімейство `setDefault*` серверних функцій)',
  // --- інше ---
  __PLUGIN_NAME__: 'плейсхолдер шаблону скаффолдера (підставляється CLI)',
  __THEME_NAME__: 'плейсхолдер шаблону скаффолдера (підставляється CLI)',
  __THEME_DISPLAY_NAME__:
    'плейсхолдер шаблону скаффолдера (підставляється CLI)',
  __CORE_RANGE__: 'плейсхолдер шаблону скаффолдера (підставляється CLI)',
  simplyCMS: 'назва організації/бренду, не символ',
  ORIENT_DOC_VENV:
    'змінна скрипта orient (файл без розширення, не індексується)',
  // --- заплановане ---
  configSchema: 'заплановане в К5: форму налаштувань плагіна ядро ще не будує',
};

// ---------- чиста логіка (під негативні контролі) ----------

export type DocFile = { path: string; text: string };

const isSymbolLike = (s: string): boolean =>
  /^[a-z_$][a-z0-9_$]*[A-Z][\w$]*$/.test(s) || // camelCase з великою всередині
  /^[A-Z][a-z0-9]+[A-Z][\w$]*$/.test(s) || // PascalCase
  /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/.test(s); // UPPER_SNAKE

/** Символи-кандидати в рядку (без тих, за якими стоїть маркер): ціле вмістиме лапок, опційно з `()`. */
function symbolsInLine(line: string): string[] {
  const out: string[] = [];
  for (const m of line.matchAll(/`([^`\n]+)`/g)) {
    const id = /^([A-Za-z_$][\w$]*)(?:\(\))?$/.exec(m[1] as string)?.[1];
    if (!id || !isSymbolLike(id)) continue;
    const rest = line.slice((m.index ?? 0) + m[0].length);
    if (HISTORICAL_AFTER.test(rest)) continue;
    out.push(id);
  }
  return out;
}

/** Блоки ``` стираються, ПЕРЕНОСИ лишаються — номери рядків не зсуваються. */
const stripFences = (text: string): string =>
  text.replace(/^```[\s\S]*?^```/gm, (block) => block.replace(/[^\n]/g, ''));

export type Missing = { symbol: string; where: string[] };

/** Символи доків, яких немає в індексі коду, без історичних рядків. */
export function missingSymbols(
  docs: readonly DocFile[],
  index: ReadonlySet<string>,
): Missing[] {
  const found = new Map<string, string[]>();
  for (const doc of docs) {
    stripFences(doc.text)
      .split('\n')
      .forEach((line, i) => {
        for (const sym of symbolsInLine(line)) {
          if (index.has(sym)) continue;
          (found.get(sym) ?? found.set(sym, []).get(sym))?.push(
            `${doc.path}:${i + 1}`,
          );
        }
      });
  }
  return [...found].map(([symbol, where]) => ({ symbol, where }));
}

// ---------- збір файлів ----------

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  '.claude',
  'coverage',
  '.output',
]);

function walk(
  dir: string,
  accept: (rel: string) => boolean,
  out: string[] = [],
): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(full, accept, out);
    } else if (accept(relative(ROOT, full).replaceAll('\\', '/')))
      out.push(full);
  }
  return out;
}

const CODE_EXT = /\.(?:tsx?|mts|cts|mjs|cjs|js|sql|json|css)$/;
const isDoc = (rel: string): boolean =>
  rel.endsWith('.md') &&
  (/^docs\/(?:architecture|development)\//.test(rel) ||
    /^packages\/[^/]+\/README\.md$/.test(rel) ||
    /^packages\/simplycms\/src\/.*README\.md$/.test(rel) ||
    rel.startsWith('packages/simplycms/skills/'));

function collectDocs(): DocFile[] {
  return [
    ...walk(join(ROOT, 'docs'), isDoc),
    ...walk(join(ROOT, 'packages'), isDoc),
  ].map((f) => ({
    path: relative(ROOT, f).replaceAll('\\', '/'),
    text: readFileSync(f, 'utf8'),
  }));
}

/** Не продакшн-код: тести, харнес, моки, e2e — їхні згадки не доводять існування символу. */
const NON_PRODUCTION =
  /(?:^|\/)(?:__tests__|test-harness|tests|e2e)\/|\.test\.|\.spec\.|\.e2e\.|mock/i;

/**
 * Прибирає коментарі й ВМІСТ рядкових літералів (лапки лишаються): згадка імені
 * в коментарі чи назві тесту не є його визначенням. Жадібний на рядки/шаблони,
 * щоб `//` усередині URL не вважався коментарем.
 */
export function stripCommentsAndStrings(
  src: string,
  keepStrings = false,
): string {
  return src.replace(
    /("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,
    (_m, str: string | undefined) =>
      str ? (keepStrings ? str : str[0] + str[0]) : '',
  );
}

const IDENT = '[A-Za-z_$][\\w$]*';
const DEF_RES: RegExp[] = [
  // function/class/const/let/var/type/interface/enum (з export чи без)
  new RegExp(
    `\\b(?:function\\*?|class|const|let|var|type|interface|enum|namespace)\\s+(${IDENT})`,
    'g',
  ),
  // ключі об'єктів-реєстрів, властивості типів, члени enum: `name:` / `name?:`.
  // Lookbehind відсікає середню гілку тернарника (`a ? name : b`): там `name` — вираз.
  new RegExp(`(?:^|[\\s,{(;])(?<!\\?\\s*)(${IDENT})\\??\\s*:(?!:)`, 'gm'),
  // методи об'єктів/класів: `name(...) {` в кінці рядка
  new RegExp(
    `^\\s*(?:(?:public|private|protected|static|async|get|set|readonly)\\s+)*(${IDENT})\\s*(?:<[^>]*>)?\\([^;]*\\)\\s*(?::[^{;]+)?\\{\\s*$`,
    'gm',
  ),
  // змінні оточення, що читає код
  new RegExp(`\\benv\\.(${IDENT})`, 'g'),
];

/** Імена з деструктуризації `const { a, b: c } =` та `export { a, b as c }`. */
function bracedNames(code: string): string[] {
  const out: string[] = [];
  const res = [
    /\b(?:const|let|var)\s*\{([^}]*)\}\s*=/g,
    /\bexport\s*\{([^}]*)\}/g,
  ];
  for (const re of res)
    for (const m of code.matchAll(re))
      for (const part of (m[1] as string).split(',')) {
        const name = part
          .trim()
          .split(/\s+as\s+|\s*:\s*/)
          .pop();
        if (name && new RegExp(`^${IDENT}$`).test(name)) out.push(name);
      }
  return out;
}

/**
 * Іменовані імпорти зі СТОРОННІХ пакетів (`react`, `@tanstack/*`, `node:*`):
 * дока називає API бібліотеки, яке код справді викликає — зникне з бібліотеки,
 * зламається збірка. Імпорти з власних шляхів сюди не йдуть: вони не визначення.
 */
function thirdPartyImports(code: string): string[] {
  const out: string[] = [];
  const re =
    /\bimport\s+(?:type\s+)?(?:\w+\s*,\s*)?\{([^}]*)\}\s*from\s*(['"])([^'"]+)\2/g;
  for (const m of code.matchAll(re)) {
    if (
      /^(?:\.|simplycms|@simplycms|@themes|@plugins|@\/)/.test(m[3] as string)
    )
      continue;
    for (const part of (m[1] as string).split(',')) {
      const name = part
        .trim()
        .split(/\s+as\s+/)[0]
        ?.replace(/^type\s+/, '');
      if (name && new RegExp(`^${IDENT}$`).test(name)) out.push(name);
    }
  }
  return out;
}

/** Ідентифікатори, ВИЗНАЧЕНІ (не лише згадані) у тексті продакшн-файла. */
export function definedIdentifiers(src: string, isJson = false): string[] {
  if (isJson)
    return [...src.matchAll(/"([A-Za-z_$][\w$]*)"\s*:/g)].map(
      (m) => m[1] as string,
    );
  const code = stripCommentsAndStrings(src);
  const out = [
    ...bracedNames(code),
    ...thirdPartyImports(stripCommentsAndStrings(src, true)),
  ];
  for (const re of DEF_RES)
    for (const m of code.matchAll(re)) out.push(m[1] as string);
  return out;
}

/** Гейт-символи з файлів тестів: лише експорти та `UPPER_SNAKE`-константи. */
export function gateIdentifiers(src: string): string[] {
  const code = stripCommentsAndStrings(src);
  const out: string[] = [];
  for (const m of code.matchAll(
    new RegExp(
      `\\bexport\\s+(?:async\\s+)?(?:default\\s+)?(?:function\\*?|class|const|let|var|type|interface|enum)\\s+(${IDENT})`,
      'g',
    ),
  ))
    out.push(m[1] as string);
  for (const m of code.matchAll(
    /\b(?:const|let)\s+([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\b/g,
  ))
    out.push(m[1] as string);
  return out;
}

function buildIndex(): Set<string> {
  const index = new Set<string>();
  // Власні експорти цього файлу (його текст у індекс не йде) — доки на них посилаються.
  index.add('DOC_SYMBOL_ALLOWLIST');
  const prod = (r: string): boolean =>
    CODE_EXT.test(r) && !NON_PRODUCTION.test(r);
  const gate = (r: string): boolean =>
    /\.(?:tsx?|mts|mjs)$/.test(r) && NON_PRODUCTION.test(r);
  const files = [
    ...[
      'packages',
      'src',
      'scripts',
      'apps',
      'plugins',
      'themes',
      'tools',
      'eslint-rules',
    ].flatMap((d) => {
      try {
        return walk(join(ROOT, d), prod);
      } catch {
        return [];
      }
    }),
    ...readdirSync(ROOT, { withFileTypes: true })
      .filter((e) => e.isFile() && /\.(?:ts|mjs|js|cjs|json)$/.test(e.name))
      .map((e) => join(ROOT, e.name)),
  ];
  const gateFiles = [
    ...['packages', 'src', 'scripts', 'tests'].flatMap((d) =>
      walk(join(ROOT, d), gate),
    ),
  ];
  for (const file of gateFiles) {
    // Сам цей файл цитує перевірювані символи (allowlist, контролі).
    if (file === import.meta.filename) continue;
    for (const id of gateIdentifiers(readFileSync(file, 'utf8'))) index.add(id);
  }
  for (const file of files) {
    let text: string;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    // Імʼя файла-модуля (`SettingsLogo.tsx` -> SettingsLogo) теж визначення.
    // Ключі i18n-каталогів — рядкові (`'auth.login.bannedContacts':`): беремо
    // кожен сегмент, бо доки називають їх по частинах.
    if (/\/i18n\/catalogs\//.test(file))
      for (const k of text.matchAll(/['"]([\w.]+)['"]\s*:/g))
        for (const seg of (k[1] as string).split('.')) index.add(seg);
    index.add(basename(file).replace(/(?:\.d)?\.[a-z]+$/, ''));
    for (const id of definedIdentifiers(text, file.endsWith('.json')))
      index.add(id);
  }
  return index;
}

// ---------- тести ----------

describe('символи в доках існують у коді', () => {
  const docs = collectDocs();
  const index = buildIndex();
  const missing = missingSymbols(docs, index);

  it('скан бачить доки (не порожній)', () => {
    expect(docs.length).toBeGreaterThan(20);
    expect(index.size).toBeGreaterThan(5000);
  });

  it('кожен символ у доках є в коді, або позначений (знесено)/(замінено …), або в allowlist з причиною', () => {
    const bad = missing.filter((m) => !(m.symbol in DOC_SYMBOL_ALLOWLIST));
    expect(
      bad.map((m) => `\`${m.symbol}\` — ${m.where.join(', ')}`),
      'символу немає в коді: виправ доку, додай у рядок «(знесено)»/«(замінено …)» або, якщо це стороннє API чи приклад, запис у DOC_SYMBOL_ALLOWLIST з причиною',
    ).toEqual([]);
  });

  it('allowlist без мертвих записів і з причинами', () => {
    const stillMissing = new Set(missing.map((m) => m.symbol));
    const dead = Object.keys(DOC_SYMBOL_ALLOWLIST).filter(
      (s) => !stillMissing.has(s),
    );
    expect(
      dead,
      'символ зник із доків або зʼявився в коді — прибери запис, список лише скорочується',
    ).toEqual([]);
    expect(
      Object.values(DOC_SYMBOL_ALLOWLIST).filter((r) => r.trim().length < 10),
    ).toEqual([]);
  });
});

describe('негативний контроль індексу визначень', () => {
  it('середня гілка тернарника не є ключем об’єкта', () => {
    const ids = definedIdentifiers(
      'const x = ok ? deleteMedia : other;\nconst y = ok\n  ? multiLine\n  : z;',
    );
    expect(ids).not.toContain('deleteMedia');
    expect(ids).not.toContain('multiLine');
    expect(definedIdentifiers('const r = { realKey: 1, opt?: 2 };')).toEqual(
      expect.arrayContaining(['realKey']),
    );
  });

  it('закоментований імпорт стороннього пакета не потрапляє в індекс', () => {
    const src =
      "// import { ghostImport } from 'react';\n/* import { ghostTwo } from 'react'; */\nimport { liveImport } from 'react';";
    const ids = definedIdentifiers(src);
    expect(ids).not.toContain('ghostImport');
    expect(ids).not.toContain('ghostTwo');
    expect(ids).toContain('liveImport');
  });
});

describe('негативний контроль', () => {
  const index = new Set(['realSymbol', 'REAL_CONST']);
  const doc = (text: string): DocFile[] => [{ path: 'x.md', text }];

  it('знесений символ без маркера червоніє', () => {
    expect(
      missingSymbols(doc('Виклик `eraseMedia` чистить файли.'), index),
    ).toEqual([{ symbol: 'eraseMedia', where: ['x.md:1'] }]);
    expect(
      missingSymbols(doc('Виклик `eraseMedia()` чистить.'), index),
    ).toHaveLength(1);
    expect(missingSymbols(doc('Опція `MAX_FAKE_LIMIT`.'), index)).toHaveLength(
      1,
    );
  });

  it('маркер гасить лише символ, після якого стоїть', () => {
    expect(missingSymbols(doc('`eraseMedia` (знесено).'), index)).toEqual([]);
    expect(
      missingSymbols(doc('`eraseMedia` (замінено на `realSymbol`).'), index),
    ).toEqual([]);
    expect(missingSymbols(doc('(знесено)\n`eraseMedia`'), index)).toHaveLength(
      1,
    );
    // маркер в іншому місці рядка не гасить інший символ
    expect(
      missingSymbols(doc('`ghostOne` (знесено), але `ghostTwo` живий'), index),
    ).toEqual([{ symbol: 'ghostTwo', where: ['x.md:1'] }]);
  });

  it('існуючі символи, прості слова й блоки коду не шумлять', () => {
    expect(
      missingSymbols(
        doc('`realSymbol` `REAL_CONST()` `React` `foo` `a.bC`'),
        index,
      ),
    ).toEqual([]);
    expect(
      missingSymbols(doc('```ts\nfakeSymbolHere();\n```\n`realSymbol`'), index),
    ).toEqual([]);
  });

  it('номер рядка не зсувається блоками коду', () => {
    const found = missingSymbols(
      doc('a\n```\nx\ny\n```\n`ghostSymbol`'),
      index,
    );
    expect(found[0]?.where).toEqual(['x.md:6']);
  });
});
