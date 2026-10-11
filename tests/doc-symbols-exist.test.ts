import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Символи в доках існують у коді.
 *
 * Навіщо. Дока, що називає `eraseMedia` чи `isSafeCssValue` ПІСЛЯ їхнього зносу,
 * бреше мовчки: рев'ю звіряє дифф із планом, а не доки з кодом (уроки Е6д —
 * `deleteMedia` лишився в доках без жодного споживача). Тест бере кожен
 * ідентифікатор у зворотних лапках, схожий на символ коду, і вимагає, щоб він
 * хоч раз зустрічався в зібраному індексі ідентифікаторів коду.
 *
 * Що сканується: markdown у `docs/architecture` і `docs/development`,
 * `packages/<pkg>/README.md`, README усередині `packages/simplycms/src` та
 * `packages/simplycms/skills`. Архів (`CHANGELOG.md`, `docs/superpowers`) — поза
 * скануванням: це історія, а не поточне твердження. Блоки коду (три
 * зворотні лапки) пропускаються — це приклади.
 *
 * «Схожий на символ»: `camelCase` / `PascalCase` з великою літерою всередині або
 * `UPPER_SNAKE`, у лапках цілком, опційно з `()`. Індекс — усі ідентифікатори
 * коду (packages, src, scripts, tests, eslint-rules, .agents, кореневі конфіги),
 * без пошуку по кожному файлу окремо.
 *
 * ЯВНИЙ маркер історичної згадки. Знесений символ, який дока мусить назвати
 * (пояснити, що його немає), позначається в ТОМУ Ж РЯДКУ дужкою `(знесено)`
 * або `(замінено …)` — наприклад «`adminLifecycle` (знесено)». Без маркера
 * рядок червоніє: інакше кожен знос лишав би в доках живе посилання на
 * неіснуюче, а з тотальним винятком тест нічого б не стерег.
 *
 * Шум — `DOC_SYMBOL_ALLOWLIST` (символ → причина): сторонні API, приклади,
 * заплановане. Список лише скорочується: запис, символ якого з'явився в коді
 * або зник із доків, червоніє (мертвий запис).
 */

const ROOT = resolve(import.meta.dirname, '..');

/** Маркер історичної згадки: `(знесено…)` / `(замінено…)` у рядку. */
const HISTORICAL_MARKER = /\((?:знесено|замінено)/;

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
  // --- заплановане ---
  configSchema: 'заплановане в К5: форму налаштувань плагіна ядро ще не будує',
};

// ---------- чиста логіка (під негативні контролі) ----------

export type DocFile = { path: string; text: string };

const isSymbolLike = (s: string): boolean =>
  /^[a-z_$][a-z0-9_$]*[A-Z][\w$]*$/.test(s) || // camelCase з великою всередині
  /^[A-Z][a-z0-9]+[A-Z][\w$]*$/.test(s) || // PascalCase
  /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/.test(s); // UPPER_SNAKE

/** Символи-кандидати в рядку: ціле вмістиме лапок, опційно з `()`. */
function symbolsInLine(line: string): string[] {
  const out: string[] = [];
  for (const m of line.matchAll(/`([^`\n]+)`/g)) {
    const id = /^([A-Za-z_$][\w$]*)(?:\(\))?$/.exec(m[1] as string)?.[1];
    if (id && isSymbolLike(id)) out.push(id);
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
        if (HISTORICAL_MARKER.test(line)) return;
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

function buildIndex(): Set<string> {
  const index = new Set<string>();
  // Власні експорти цього файлу (його текст у індекс не йде) — доки на них посилаються.
  index.add('DOC_SYMBOL_ALLOWLIST');
  const files = [
    ...walk(join(ROOT, 'packages'), (r) => CODE_EXT.test(r)),
    ...['src', 'scripts', 'tests', 'eslint-rules', '.agents'].flatMap((d) =>
      walk(join(ROOT, d), (r) => !r.endsWith('.md')),
    ),
    ...readdirSync(ROOT, { withFileTypes: true })
      .filter((e) => e.isFile() && /\.(?:ts|mjs|js|cjs|json)$/.test(e.name))
      .map((e) => join(ROOT, e.name)),
  ];
  for (const file of files) {
    // Сам цей файл цитує перевірювані символи (allowlist, контролі) — інакше
    // кожен запис «існував би» завдяки власному ключу.
    if (file === import.meta.filename) continue;
    let text: string;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const m of text.matchAll(/[A-Za-z_$][\w$]*/g)) index.add(m[0]);
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

  it('маркер (знесено)/(замінено …) у тому ж рядку гасить, у сусідньому — ні', () => {
    expect(missingSymbols(doc('`eraseMedia` (знесено).'), index)).toEqual([]);
    expect(
      missingSymbols(doc('`eraseMedia` (замінено на `realSymbol`).'), index),
    ).toEqual([]);
    expect(missingSymbols(doc('(знесено)\n`eraseMedia`'), index)).toHaveLength(
      1,
    );
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
