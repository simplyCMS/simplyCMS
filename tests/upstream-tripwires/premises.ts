import { drizzle } from 'drizzle-orm/node-postgres';
import { pgTable, text, uuid } from 'drizzle-orm/pg-core';

/**
 * Передумови обходів для `upstream-tripwires.test.ts` (що стереже і чому — у
 * шапці тесту). Кожна — чиста функція від тексту встановленого модуля.
 */

// ---------- передумови: чисті функції від тексту; порожній масив = тримається ----------

/** Повертає перелік порушених передумов. */
export type Premise = (src: string) => string[];

const need =
  (checks: Record<string, (src: string) => boolean>): Premise =>
  (src) =>
    Object.entries(checks)
      .filter(([, ok]) => !ok(src))
      .map(([what]) => what);

export const startBody: Premise = need({
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
export const startFormBeforeHandler: Premise = (src) => {
  const form = src.indexOf('await request.formData()');
  const action = src.indexOf('await action(', form);
  return form >= 0 && action > form
    ? []
    : ['formData() більше не передує виклику хендлера'];
};

/** START-BODY-1: шлях serverFn береться з TSS_SERVER_FN_BASE (стеля тіла читає ту саму змінну). */
export const startFnBase: Premise = need({
  'RPC-клієнт будує URL з process.env.TSS_SERVER_FN_BASE': (s) =>
    /process\.env\.TSS_SERVER_FN_BASE\s*\+/.test(s),
});

export const shallowError: Premise = need({
  'плагін тегу $TSR/Error досі існує': (s) => s.includes('"$TSR/Error"'),
  'parse віддає лише message': (s) =>
    /parse:\s*\{[\s\S]*?return \{ message: ctx\.parse\(value\.message\) \}/.test(
      s,
    ),
  'deserialize відновлює голий new Error(message)': (s) =>
    /new Error\(ctx\.deserialize\(node\.message\)\)/.test(s),
});

export const parseSubsetNoOffset: Premise = (src) => {
  const start = src.indexOf('function parseLoadSubsetOptions');
  const end = src.indexOf('\nexport', start);
  if (start < 0) return ['parseLoadSubsetOptions зник'];
  return /offset/.test(src.slice(start, end))
    ? ['parseLoadSubsetOptions уже повертає offset']
    : [];
};

export const subsetOptionsNotReexported: Premise = (src) =>
  /\bLoadSubsetOptions\b/.test(src)
    ? ['index.d.ts уже згадує LoadSubsetOptions']
    : [];

export const drizzleWrapsCause: Premise = need({
  'pg-session кидає DrizzleQueryError(query, params, e)': (s) =>
    s.includes('throw new DrizzleQueryError(queryString, params, e)'),
});
export const drizzleErrorCause: Premise = need({
  'DrizzleQueryError кладе драйверну помилку в .cause': (s) =>
    /constructor\(query, params, cause\)[\s\S]*this\.cause = cause/.test(s),
});

export const tsEslintPeer: Premise = (src) => {
  const range = (
    JSON.parse(src) as { peerDependencies?: Record<string, string> }
  ).peerDependencies?.typescript;
  return range?.includes('<6.1.0') ? [] : [`peer typescript тепер «${range}»`];
};

/** DRIZ-1: версія ORM — рішення «чекати stable 1.0»; мажор змінився — час переглянути. */
export const drizzleStillZeroX: Premise = (src) =>
  /^0\./.test(src.trim()) ? [] : [`drizzle-orm тепер ${src.trim()}`];

/** DRZ-INSERT-1: SQL вставки називає колонку, якої немає в `values()` (вона піде як default). */
export const insertNamesDefaultedColumns: Premise = (sql) =>
  /"note"/.test(sql) && /default/i.test(sql)
    ? []
    : [`SQL вставки не називає колонку з default: ${sql}`];

export function buildInsertSql(): string {
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
